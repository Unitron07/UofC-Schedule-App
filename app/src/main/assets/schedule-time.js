(function (root) {
  "use strict";
  const E =
    typeof module !== "undefined"
      ? require("./calendar.js")
      : root.CalendarEngine;
  function validZone(zone) {
    if (typeof zone !== "string" || !zone.trim()) return false;
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
      return true;
    } catch (e) {
      return false;
    }
  }
  function deviceZone() {
    try {
      const zone = root.Android?.timeZone?.();
      if (validZone(zone)) return zone;
    } catch (e) {}
    return new Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  function resolveZone(prefs, phoneZone = deviceZone()) {
    const zone = prefs.usePhoneZone ? phoneZone : prefs.timeZone;
    return validZone(zone) ? zone : E.ZONE;
  }
  function zones(selected) {
    const common = [
      E.ZONE,
      E.ABT_ZONE,
      "UTC",
      "America/Vancouver",
      "America/Regina",
      "America/Winnipeg",
      "America/Toronto",
      "America/Halifax",
      "America/St_Johns",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Asia/Kolkata",
      "Asia/Shanghai",
      "Asia/Tokyo",
      "Australia/Sydney",
      "Pacific/Auckland",
    ];
    const available =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : common;
    return [...new Set([...common, ...available, selected])]
      .filter(validZone)
      .sort();
  }
  function midnight(day, zone) {
    const [year, month, date] = day.split("-").map(Number);
    return E.wallToEpoch({ year, month, day: date }, zone);
  }
  // Project saved instants into the display zone. Never rewrite the imported schedule.
  function project(schedule, zone) {
    if (!schedule) return null;
    const events = schedule.events.map((e) => {
      if (e.allDay) {
        const exclusive = E.dateKey(e.end);
        return {
          ...e,
          start: midnight(e.day, zone),
          end: midnight(exclusive, zone),
          endDay: E.dateKey(e.end - 1),
        };
      }
      return {
        ...e,
        day: E.dateKey(e.start, zone),
        endDay: E.dateKey(Math.max(e.start, e.end - 1), zone),
      };
    });
    events.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
    return {
      ...schedule,
      events,
      first: events.reduce(
        (day, e) => (e.day < day ? e.day : day),
        events[0].day,
      ),
      last: events.reduce(
        (day, e) => (e.endDay > day ? e.endDay : day),
        events[0].endDay,
      ),
    };
  }
  const api = { validZone, deviceZone, resolveZone, zones, project };
  if (typeof module !== "undefined") module.exports = api;
  else root.ScheduleTime = api;
})(typeof window !== "undefined" ? window : globalThis);
