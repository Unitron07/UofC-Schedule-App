const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const E = require("../app/src/main/assets/calendar.js");
const wrap = (body) => `BEGIN:VCALENDAR\nVERSION:2.0\n${body}\nEND:VCALENDAR`;
const event = (
  extra = "",
  start = "DTSTART:20260910T170000Z",
  end = "DTEND:20260910T180000Z",
) =>
  `BEGIN:VEVENT\nUID:class-1\n${start}\n${end}\nSUMMARY:Example class\nLOCATION:Room 100\n${extra}\nEND:VEVENT`;
test("UTC events display on the right Calgary day and time", () => {
  const s = E.parse(wrap(event()));
  assert.equal(s.events[0].day, "2026-09-10");
  assert.equal(E.parts(s.events[0].start).hour, "11");
});
test("CR, LF and CRLF exports produce identical schedules", () => {
  const src = wrap(event());
  for (const sep of ["\r", "\r\n", "\n"])
    assert.equal(E.parse(src.replace(/\n/g, sep)).events.length, 1);
});
test("Weekly recurrence honors exception dates", () => {
  const s = E.parse(
    wrap(event("RRULE:FREQ=WEEKLY;COUNT=3\nEXDATE:20260917T170000Z")),
  );
  assert.deepEqual(
    s.events.map((e) => e.day),
    ["2026-09-10", "2026-09-24"],
  );
});
test("Moved recurrence uses the exception time and room", () => {
  const master = event("RRULE:FREQ=WEEKLY;COUNT=2");
  const moved = event(
    "RECURRENCE-ID:20260917T170000Z",
    "DTSTART:20260918T170000Z",
    "DTEND:20260918T180000Z",
  ).replace("Room 100", "Room 200");
  const s = E.parse(wrap(master + "\n" + moved));
  assert.deepEqual(
    s.events.map((e) => e.day),
    ["2026-09-10", "2026-09-18"],
  );
  assert.equal(s.events[1].location, "Room 200");
});
test("Cancelled recurrence is omitted", () => {
  const s = E.parse(
    wrap(
      event("RRULE:FREQ=WEEKLY;COUNT=2") +
        "\n" +
        event(
          "RECURRENCE-ID:20260917T170000Z\nSTATUS:CANCELLED",
          "DTSTART:20260917T170000Z",
          "DTEND:20260917T180000Z",
        ),
    ),
  );
  assert.equal(s.events.length, 1);
});
test("Duplicate UID and occurrence are deduplicated", () =>
  assert.equal(E.parse(wrap(event() + "\n" + event())).events.length, 1));
test("Floating times are interpreted in Calgary, independent of device zone", () => {
  const s = E.parse(
    wrap(event("", "DTSTART:20260910T110000", "DTEND:20260910T120000")),
  );
  assert.equal(
    new Date(s.events[0].start).toISOString(),
    "2026-09-10T17:00:00.000Z",
  );
});
test("IANA zones without VTIMEZONE preserve local time through DST", () => {
  const s = E.parse(
    wrap(
      event(
        "RRULE:FREQ=WEEKLY;COUNT=3",
        "DTSTART;TZID=America/Edmonton:20261026T110000",
        "DTEND;TZID=America/Edmonton:20261026T120000",
      ),
    ),
  );
  assert.equal(new Date(s.events[0].start).getUTCHours(), 17);
  assert.equal(new Date(s.events[1].start).getUTCHours(), 18);
  assert.ok(s.events.every((e) => E.parts(e.start).hour === "11"));
});
test("All-day events keep dates and exclusive end", () => {
  const s = E.parse(
    wrap(event("", "DTSTART;VALUE=DATE:20260910", "DTEND;VALUE=DATE:20260912")),
  );
  assert.equal(s.events[0].allDay, true);
  assert.equal(s.events[0].day, "2026-09-10");
  assert.equal(s.last, "2026-09-11");
});
test("Folded lines and escaped text are preserved", () => {
  const s = E.parse(
    wrap(
      event().replace(
        "Example class",
        "A long title\n continued\\, with comma",
      ),
    ),
  );
  assert.equal(s.courses[0], "A long titlecontinued, with comma");
});
test("HTML in event text remains data", () => {
  const s = E.parse(
    wrap(event().replace("Example class", "<img src=x onerror=alert(1)>")),
  );
  assert.equal(s.courses[0], "<img src=x onerror=alert(1)>");
});
test("Empty, malformed and oversized input fail clearly", () => {
  assert.throws(() => E.parse(wrap("")), /empty/);
  assert.throws(() => E.parse("<html>login</html>"), /not an .ics/);
  assert.throws(() => E.parse("x".repeat(2097153)), /smaller/);
});
test("Invalid end and unsupported time zones are rejected", () => {
  assert.throws(
    () =>
      E.parse(
        wrap(event("", "DTSTART:20260910T170000Z", "DTEND:20260910T160000Z")),
      ),
    /invalid/,
  );
  assert.throws(
    () =>
      E.parse(
        wrap(
          event(
            "",
            "DTSTART;TZID=Fake\/Zone:20260910T110000",
            "DTEND;TZID=Fake\/Zone:20260910T120000",
          ),
        ),
      ),
    /time zone/,
  );
});
test("High frequency rules are rejected without hanging", () =>
  assert.throws(
    () => E.parse(wrap(event("RRULE:FREQ=SECONDLY;COUNT=1000000"))),
    /frequently/,
  ));
test("Open-ended events have an explicit finite horizon", () => {
  const s = E.parse(wrap(event("RRULE:FREQ=WEEKLY")));
  assert.equal(s.bounded, true);
  assert.ok(s.events.length < 1000);
});
