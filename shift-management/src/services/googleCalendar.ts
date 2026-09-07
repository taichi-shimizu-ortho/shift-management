import { supabase } from '../lib/supabaseClient';
import { cleanDisplayName } from '../lib/displayName';

// 「(赤池)花田先生」形式。括弧の中が勤務先、後ろが交代した医師名。
// 全角・半角どちらの括弧も許容する。
const SWAP_PATTERN = /^[(（]\s*([^)）]+?)\s*[)）]\s*(.*)$/;

type DoctorRow = { id: string; full_name: string; display_name?: string | null };

// 「花田先生」「花田医師」のような敬称を落とす
function normalizeDoctorName(name: string): string {
  return cleanDisplayName(name)
    .replace(/(先生|医師|Dr\.?)\s*$/i, '')
    .trim();
}

// 予定名の医師名とプロフィールを照合する。
// カレンダーには名字だけ、プロフィールはフルネームというズレがあるので、
// どちらかがもう一方を含むなら同一人物とみなす。
function findDoctor(rawName: string, doctors: DoctorRow[]): DoctorRow | null {
  const needle = normalizeDoctorName(rawName);
  if (!needle) return null;

  for (const doctor of doctors) {
    const candidates = [doctor.display_name, doctor.full_name]
      .filter((v): v is string => Boolean(v))
      .map(normalizeDoctorName)
      .filter(Boolean);

    if (candidates.some((c) => c === needle || c.includes(needle) || needle.includes(c))) {
      return doctor;
    }
  }

  return null;
}

export type SyncResult = {
  matched: number;
  added: number;
  skipped: number;
  calendarErrors: string[];
  /** どのリストにも一致しなかった予定名（重複除く） */
  unmatched: string[];
  /** 括弧表記だったが、医師一覧に見つからなかった名前 */
  unknownDoctors: string[];
};

export async function syncGoogleCalendar(providerToken: string): Promise<SyncResult> {
  // 1. Fetch user settings
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: settings } = await supabase
    .from('user_settings')
    .select('external_duty_names, night_duty_names, calendar_ids')
    .eq('user_id', user.id)
    .maybeSingle();

  const externalDutyNames = settings?.external_duty_names || ["新小倉", "赤池", "稲築", "タケスポ", "新庄", "芳野", "小波瀬"];
  const nightDutyNames = settings?.night_duty_names || ["当直", "若松", "若松日当直"];
  const calendarIds: string[] = settings?.calendar_ids?.length
    ? settings.calendar_ids
    : ['primary'];

  // No filter configured
  if (externalDutyNames.length === 0 && nightDutyNames.length === 0) {
    throw new Error('外勤・当直の名前が1つも登録されていません。');
  }

  // 2. Fetch shift types
  const { data: shiftTypes } = await supabase
    .from('shift_types')
    .select('id, name');
  
  let externalDutyShiftType = shiftTypes?.find(st => st.name === '外勤');
  let nightDutyShiftType = shiftTypes?.find(st => st.name === '当直');

  if (!shiftTypes || shiftTypes.length === 0) {
    throw new Error("No shift types available.");
  }
  
  // Fallback if exactly named shift types don't exist
  if (!externalDutyShiftType) {
    console.warn("No shift type named '外勤' found. Using the first available shift type as fallback.");
    externalDutyShiftType = shiftTypes[0];
  }
  if (!nightDutyShiftType) {
    console.warn("No shift type named '当直' found. Using the first available shift type as fallback.");
    nightDutyShiftType = shiftTypes[0];
  }

  // 2b. 交代した外勤を他の医師の予定として登録するため、医師一覧を引いておく
  const { data: doctors } = await supabase
    .from('profiles')
    .select('id, full_name, display_name');

  // 3. Fetch Google Calendar events (for current month and next month)
  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

  // 複数カレンダー（本人の primary ＋ ファミリー等の共有カレンダー）を順に取得する
  const events: any[] = [];
  const calendarErrors: string[] = [];

  for (const calendarId of calendarIds) {
    // 定期予定は singleEvents=true で回ごとに展開されるため件数が膞らむ。
    // Google は 1 リクエストあたり最大 2500 件しか返さないので、
    // nextPageToken が無くなるまで追いかけないと途中の予定が欠落する。
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '2500',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        {
          headers: {
            Authorization: `Bearer ${providerToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 401) {
        // トークン切れ。他のカレンダーを試しても同じなので即座に中断する。
        throw new Error(
          'Googleの認証が切れています。一度ログアウトしてGoogleログインし直してください。'
        );
      }

      if (!response.ok) {
        // 1つのカレンダーが取得できなくても他のカレンダーの同期は続行する
        const message = `カレンダー「${calendarId}」を読み込めませんでした (${response.status} ${response.statusText})`;
        console.warn(message);
        calendarErrors.push(message);
        break;
      }

      const data = await response.json();
      events.push(...(data.items || []));
      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  // 取得できた予定を全件出す。「アプリに出ない予定が、そもそも取得できていないのか、
  // 取得できているのに名前が一致していないのか」を切り分けるための手がかり。
  console.log(
    `Fetched ${events.length} events from ${calendarIds.length} calendar(s):`,
    events.map((e: any) => ({
      date: e.start?.date || e.start?.dateTime,
      summary: e.summary,
      recurring: Boolean(e.recurringEventId),
    }))
  );

  // 4. Process matching events
  const eventsToSync: { event: any; shiftTypeId: number; doctorId: string; note: string }[] = [];

  const unmatched = new Set<string>();
  const unknownDoctors = new Set<string>();

  // 完全一致だけだと、予定名に余分な文字（「稲築病院 午前」など）が付いているだけで拾えない。
  // まず完全一致を見て、無ければ部分一致（予定名に登録名が含まれるか）で拾う。
  const matchName = (summary: string, names: string[]) =>
    names.includes(summary) || names.some((name) => name && summary.includes(name));

  events.forEach((event: any) => {
    const summary = event.summary?.trim();
    if (!summary) return;

    // 「(赤池)花田先生」のように括弧で始まる予定は、交代して他の医師が担当する勤務。
    // 括弧の中が勤務先、後ろがその医師名になる。
    const swap = summary.match(SWAP_PATTERN);
    const dutyLabel = swap ? swap[1] : summary;
    const otherDoctorName = swap ? swap[2] : '';

    let shiftTypeId: number;
    if (matchName(dutyLabel, externalDutyNames)) {
      shiftTypeId = externalDutyShiftType.id;
    } else if (matchName(dutyLabel, nightDutyNames)) {
      shiftTypeId = nightDutyShiftType.id;
    } else {
      // 実際の予定名を見せて、設定の取りこぼしを判断できるようにする
      unmatched.add(summary);
      return;
    }

    // 括弧表記でなければ自分の勤務
    if (!swap || !otherDoctorName) {
      eventsToSync.push({ event, shiftTypeId, doctorId: user.id, note: summary });
      return;
    }

    const other = findDoctor(otherDoctorName, doctors ?? []);
    if (!other) {
      // 見つからない医師を自分の予定として登録すると間違ったシフトになるので、
      // 登録せずに報告だけして医師の追加を促す。
      unknownDoctors.add(otherDoctorName);
      return;
    }

    // バッジは「花田（赤池）」と出したいので、note には勤務先だけを入れる
    eventsToSync.push({ event, shiftTypeId, doctorId: other.id, note: dutyLabel });
  });

  if (eventsToSync.length === 0) {
    return {
      matched: 0,
      added: 0,
      skipped: 0,
      calendarErrors,
      unmatched: [...unmatched],
      unknownDoctors: [...unknownDoctors],
    };
  }

  // 5. Fetch existing assignments to avoid duplicates
  // 他の医師分も登録するようになったので、自分の分だけでなく全員分を見る。
  // （assignments の unique 制約は doctor_id + shift_type_id + duty_date）
  const { data: existingAssignments } = await supabase
    .from('assignments')
    .select('id, duty_date, shift_type_id, doctor_id')
    .gte('duty_date', timeMin.split('T')[0])
    .lte('duty_date', timeMax.split('T')[0]);

  let added = 0;
  let skipped = 0;

  for (const { event, shiftTypeId, doctorId, note } of eventsToSync) {
    // Google Calendar all-day event uses start.date, timed event uses start.dateTime
    const eventDateStr = event.start.date || event.start.dateTime.split('T')[0];

    const exists = existingAssignments?.some(
      a =>
        a.duty_date === eventDateStr &&
        a.shift_type_id === shiftTypeId &&
        a.doctor_id === doctorId
    );

    if (exists) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from('assignments').insert({
      doctor_id: doctorId,
      shift_type_id: shiftTypeId,
      duty_date: eventDateStr,
      note, // 詳細欄にこの値を入れる
    });

    // 書き込みの失敗を黙って捨てると「同期成功なのに予定が出ない」状態になるので、
    // RLS 拒否などはその場で中断して呼び出し元に伝える。
    if (error) {
      throw new Error(
        `予定の登録に失敗しました (${eventDateStr} / ${event.summary}): ${error.message}`
      );
    }

    added++;
  }

  console.log(`Calendar sync complete. Added ${added}, skipped ${skipped}.`);
  return {
    matched: eventsToSync.length,
    added,
    skipped,
    calendarErrors,
    unmatched: [...unmatched],
    unknownDoctors: [...unknownDoctors],
  };
}
