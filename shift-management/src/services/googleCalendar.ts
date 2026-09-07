import { supabase } from '../lib/supabaseClient';

export async function syncGoogleCalendar(providerToken: string) {
  try {
    // 1. Fetch user settings
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data: settings } = await supabase
      .from('user_settings')
      .select('external_duty_names, night_duty_names')
      .eq('user_id', user.id)
      .maybeSingle();

    const externalDutyNames = settings?.external_duty_names || ["新小倉", "赤池", "稲築", "タケスポ", "新庄", "芳野", "小波瀬"];
    const nightDutyNames = settings?.night_duty_names || ["当直", "若松", "若松日当直"];

    if (externalDutyNames.length === 0 && nightDutyNames.length === 0) return; // No filter configured

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

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${providerToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Calendar events: ${response.statusText}`);
    }

    const data = await response.json();
    const events = data.items || [];

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

    if (eventsToSync.length === 0) return;

    // 5. Fetch existing assignments to avoid duplicates
    const { data: existingAssignments } = await supabase
      .from('assignments')
      .select('id, duty_date, shift_type_id, note')
      .eq('doctor_id', user.id)
      .gte('duty_date', timeMin.split('T')[0])
      .lte('duty_date', timeMax.split('T')[0]);

    for (const { event, shiftTypeId } of eventsToSync) {
      // Google Calendar all-day event uses start.date, timed event uses start.dateTime
      const eventDateStr = event.start.date || event.start.dateTime.split('T')[0];
      
      const exists = existingAssignments?.some(
        a => a.duty_date === eventDateStr && a.shift_type_id === shiftTypeId
      );

      if (!exists) {
        await supabase.from('assignments').insert({
          doctor_id: user.id,
          shift_type_id: shiftTypeId,
          duty_date: eventDateStr,
          note: event.summary, // 詳細欄にこの値を入れる
        });
      }
    }
    console.log("Calendar sync complete. Added", eventsToSync.length, "shifts.");
  } catch (error) {
    console.error('Error syncing Google Calendar:', error);
  }
}
