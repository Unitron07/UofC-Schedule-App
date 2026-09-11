(function (root) {
  "use strict";
  const ICAL = typeof module !== "undefined" ? require("./ical.js") : root.ICAL;
  const ZONE = "America/Edmonton";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  function parts(ms, zone) {
    const fmt =
      !zone || zone === ZONE
        ? formatter
        : new Intl.DateTimeFormat("en-CA", {
            timeZone: zone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          });
    return Object.fromEntries(
      fmt
        .formatToParts(new Date(ms))
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    );
  }
  function dateKey(ms) {
    const p = parts(ms);
    return `${p.year}-${p.month}-${p.day}`;
  }
  function wallToEpoch(t, zone) {
    const wanted = Date.UTC(
      t.year,
      t.month - 1,
      t.day,
      t.hour || 0,
      t.minute || 0,
      t.second || 0,
    );
    let guess = wanted;
    for (let i = 0; i < 3; i++) {
      const p = parts(guess, zone);
      const actual = Date.UTC(
        +p.year,
        +p.month - 1,
        +p.day,
        +p.hour,
        +p.minute,
        t.second || 0,
      );
      guess += wanted - actual;
    }
    return guess;
  }
  function epoch(time, comp, prop) {
    const tzid = comp.getFirstProperty(prop)?.getParameter("tzid");
    if (time.zone.tzid === "floating") return wallToEpoch(time, tzid || ZONE);
    return time.toUnixTime() * 1000;
  }
  function parse(text, filename = "Timetable.ics") {
    if (typeof text !== "string" || text.length > 2097152)
      throw new Error("Choose an .ics calendar smaller than 2 MB.");
    // UCalgary exports mix CRLF, LF and bare CR line endings in a single file.
    text = text
      .replace(/^\uFEFF/, "")
      .replace(/\r\n|\r|\n/g, "\r\n")
      .trim();
    if (!/^BEGIN:VCALENDAR/i.test(text) || !/END:VCALENDAR\s*$/i.test(text))
      throw new Error(
        "This is not an .ics calendar. Download Calendar from Student Centre, then choose that file.",
      );
    ICAL.TimezoneService.reset();
    let cal;
    try {
      cal = new ICAL.Component(ICAL.parse(text));
    } catch (e) {
      throw new Error(
        "This calendar could not be read. Try downloading a fresh copy from Student Centre.",
      );
    }
    cal
      .getAllSubcomponents("vtimezone")
      .forEach((c) => ICAL.TimezoneService.register(new ICAL.Timezone(c)));
    const components = cal.getAllSubcomponents("vevent");
    if (!components.length)
      throw new Error(
        "This calendar is empty. Select your semester in Student Centre and download it again.",
      );
    if (components.length > 2000)
      throw new Error(
        "This calendar has too many entries. Import one semester at a time.",
      );
    // Calendar apps may use IANA identifiers without embedding VTIMEZONE.
    for (const c of components)
      for (const property of c.getAllProperties()) {
        const id = property.getParameter("tzid");
        if (id && !ICAL.TimezoneService.has(id)) {
          try {
            parts(Date.now(), id);
          } catch (e) {
            throw new Error(
              "This calendar uses an unrecognized time zone. Try a fresh university export.",
            );
          }
          const zone = new ICAL.Timezone({ tzid: id });
          zone.utcOffset = (t) =>
            (Date.UTC(
              t.year,
              t.month - 1,
              t.day,
              t.hour || 0,
              t.minute || 0,
              t.second || 0,
            ) -
              wallToEpoch(t, id)) /
            1000;
          ICAL.TimezoneService.register(zone);
        }
      }
    const events = [],
      seen = new Set();
    let bounded = false;
    const deadline = Date.now() + 5000;
    for (const c of components) {
      if (c.getFirstPropertyValue("status") === "CANCELLED") continue;
      if (!c.getFirstProperty("dtstart"))
        throw new Error(
          "A calendar entry has no start date. Please download a fresh copy.",
        );
      const ev = new ICAL.Event(c);
      if (ev.isRecurrenceException()) continue;
      for (const p of c.getAllProperties("rrule")) {
        const rule = p.getFirstValue();
        if (["SECONDLY", "MINUTELY", "HOURLY"].includes(rule.freq))
          throw new Error(
            "This file repeats events too frequently for a class timetable.",
          );
        // The portal emits a local UNTIL with a zoned DTSTART. Repair that
        // non-standard combination so the final day's classes are included.
        if (
          rule.until &&
          !rule.until.isDate &&
          rule.until.zone.tzid === "floating" &&
          ev.startDate.zone.tzid !== "floating"
        ) {
          const until = rule.until.clone();
          until.zone = ev.startDate.zone;
          rule.until = until.convertToZone(ICAL.Timezone.utcTimezone);
          p.setValue(rule);
        }
      }
      const iterator = ev.iterator();
      // UCalgary includes EXDATEs on days that are not in the recurrence.
      // Check the complete exclusion set as well as the library's iterator.
      const excludedTimes = new Set(),
        excludedDays = new Set();
      c.getAllProperties("exdate").forEach((p) =>
        p.getValues().forEach((t) => {
          if (t.isDate) excludedDays.add(t.toString());
          else excludedTimes.add(epoch(t, c, "exdate"));
        }),
      );
      const infinite = c
        .getAllProperties("rrule")
        .some((p) => !p.getFirstValue().until && !p.getFirstValue().count);
      const horizon =
        Math.max(Date.now(), epoch(ev.startDate, c, "dtstart")) +
        730 * 86400000;
      let next,
        count = 0;
      while ((next = iterator.next())) {
        if (++count > 20000 || events.length > 20000 || Date.now() > deadline)
          throw new Error(
            "This calendar is too large to import. Choose a single semester.",
          );
        if (
          excludedTimes.has(epoch(next, c, "dtstart")) ||
          excludedDays.has(next.toString().slice(0, 10))
        )
          continue;
        const detail = ev.getOccurrenceDetails(next);
        const item = detail.item;
        if (item.component.getFirstPropertyValue("status") === "CANCELLED")
          continue;
        const start = epoch(detail.startDate, item.component, "dtstart");
        const end = epoch(detail.endDate, item.component, "dtend");
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
          throw new Error(
            "A class contains an invalid date or time. Try a fresh calendar export.",
          );
        if (infinite && start > horizon) {
          bounded = true;
          break;
        }
        const title = String(item.summary || "Untitled class").trim();
        const location = String(item.location || "Room not listed").trim();
        const id = `${item.uid || title}|${start}|${end}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const allDay = detail.startDate.isDate;
        const day = allDay
          ? detail.startDate.toString().slice(0, 10)
          : dateKey(start);
        const organizer = item.component.getFirstProperty("organizer");
        const person = String(organizer?.getParameter("cn") || "").trim();
        const instructor = /^(TBD|TBA|unknown|staff)$/i.test(person)
          ? ""
          : person;
        events.push({
          id,
          title,
          location,
          start,
          end,
          day,
          allDay,
          instructor,
        });
      }
    }
    if (!events.length)
      throw new Error("No scheduled classes were found in this calendar.");
    events.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
    const courses = [...new Set(events.map((e) => e.title))].sort();
    return {
      version: 1,
      name: String(
        cal.getFirstPropertyValue("x-wr-calname") || "My timetable",
      ).trim(),
      filename,
      importedAt: Date.now(),
      events,
      courses,
      first: events[0].day,
      last: dateKey(Math.max(...events.map((e) => e.end - 1))),
      bounded,
    };
  }
  const api = { parse, dateKey, parts, wallToEpoch, ZONE };
  if (typeof module !== "undefined") module.exports = api;
  else root.CalendarEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
