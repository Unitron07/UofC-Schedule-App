(function (root) {
  "use strict";
  const E =
    typeof module !== "undefined"
      ? require("./calendar.js")
      : root.CalendarEngine;
  function defaultDay(schedule, now = Date.now()) {
    const today = E.dateKey(now);
    const events = (schedule?.events || []).filter((e) => e.day === today);
    if (
      !events.length ||
      events.some((e) => !Number.isFinite(e.end) || e.end > now)
    )
      return today;
    const next = new Date(today + "T12:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  }
  const api = { defaultDay };
  if (typeof module !== "undefined") module.exports = api;
  else root.DayDefault = api;
})(typeof window !== "undefined" ? window : globalThis);
