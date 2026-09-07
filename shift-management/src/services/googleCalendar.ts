import { supabase } from '../lib/supabaseClient';

export type SyncResult = {
  matched: number;
  added: number;
  skipped: number;
  calendarErrors: string[];
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

  // 4. Process matching events
  // We categorize them into external duty and night duty
  const eventsToSync: { event: any, shiftTypeId: number }[] = [];

  events.forEach((event: any) => {
    const summary = event.summary;
    if (!summary) return;

    if (externalDutyNames.includes(summary)) {
      eventsToSync.push({ event, shiftTypeId: externalDutyShiftType.id });
    } else if (nightDutyNames.includes(summary)) {
      eventsToSync.push({ event, shiftTypeId: nightDutyShiftType.id });
    }
  });

  if (eventsToSync.length === 0) {
    return { matched: 0, added: 0, skipped: 0, calendarErrors };
  }

  // 5. Fetch existing assignments to avoid duplicates
  const { data: existingAssignments } = await supabase
    .from('assignments')
    .select('id, duty_date, shift_type_id, note')
    .eq('doctor_id', user.id)
    .gte('duty_date', timeMin.split('T')[0])
    .lte('duty_date', timeMax.split('T')[0]);

  let added = 0;
  let skipped = 0;

  for (const { event, shiftTypeId } of eventsToSync) {
    // Google Calendar all-day event uses start.date, timed event uses start.dateTime
    const eventDateStr = event.start.date || event.start.dateTime.split('T')[0];

    const exists = existingAssignments?.some(
      a => a.duty_date === eventDateStr && a.shift_type_id === shiftTypeId
    );

    if (exists) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from('assignments').insert({
      doctor_id: user.id,
      shift_type_id: shiftTypeId,
      duty_date: eventDateStr,
      note: event.summary, // 詳細欄にこの値を入れる
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
  return { matched: eventsToSync.length, added, skipped, calendarErrors };
}
