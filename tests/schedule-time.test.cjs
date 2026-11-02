const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../app/src/main/assets/calendar.js");
const T = require("../app/src/main/assets/schedule-time.js");
const { defaultDay } = require("../app/src/main/assets/day-default.js");
const fs = require("node:fs"),
  vm = require("node:vm"),
  { createRequire } = require("node:module");
const calendar = (body) =>
  E.parse(
    `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test\nSUMMARY:Example class\n${body}\nEND:VEVENT\nEND:VCALENDAR`,
  );

test("Legacy and invalid settings fall back to Calgary; phone mode uses the detected zone", () => {
  assert.equal(T.resolveZone({}, "Asia/Tokyo"), E.ZONE);
  assert.equal(T.resolveZone({ timeZone: "Invalid/Zone" }), E.ZONE);
  assert.equal(
    T.resolveZone({ timeZone: "UTC", usePhoneZone: true }, "Asia/Tokyo"),
    "Asia/Tokyo",
  );
  assert.equal(
    T.resolveZone({ timeZone: "UTC", usePhoneZone: false }, "Asia/Tokyo"),
    "UTC",
  );
});
test("Time-zone changes move timed meetings across dates without changing saved instants or IDs", () => {
  const raw = calendar("DTSTART:20260910T233000Z\nDTEND:20260911T003000Z");
  const saved = JSON.stringify(raw);
  const view = T.project(raw, "Pacific/Auckland");
  assert.equal(view.events[0].day, "2026-09-11");
  assert.equal(view.first, "2026-09-11");
  assert.equal(view.last, "2026-09-11");
  for (const key of ["id", "start", "end"])
    assert.equal(view.events[0][key], raw.events[0][key]);
  assert.equal(JSON.stringify(raw), saved);
  assert.equal(T.project(raw, E.ZONE).events[0].day, raw.events[0].day);
});
test("All-day dates and exclusive ends stay on their calendar dates in other zones", () => {
  const raw = calendar(
    "DTSTART;VALUE=DATE:20260910\nDTEND;VALUE=DATE:20260912",
  );
  for (const zone of ["Pacific/Auckland", "America/Los_Angeles", "UTC"]) {
    const view = T.project(raw, zone),
      e = view.events[0];
    assert.equal(e.day, "2026-09-10");
    assert.equal(e.endDay, "2026-09-11");
    assert.equal(E.dateKey(e.start, zone), "2026-09-10");
    assert.equal(E.dateKey(e.end, zone), "2026-09-12");
    assert.equal(view.last, "2026-09-11");
  }
});
test("The default day follows the display zone and includes overnight meetings", () => {
  const view = T.project(
    calendar("DTSTART:20260910T233000Z\nDTEND:20260911T013000Z"),
    "UTC",
  );
  assert.equal(
    defaultDay(view, Date.parse("2026-09-11T01:00:00Z"), "UTC"),
    "2026-09-11",
  );
  assert.equal(
    defaultDay(view, Date.parse("2026-09-11T01:30:00Z"), "UTC"),
    "2026-09-12",
  );
  const tokyo = T.project(
    calendar("DTSTART:20260910T233000Z\nDTEND:20260911T013000Z"),
    "Asia/Tokyo",
  );
  assert.equal(
    defaultDay(tokyo, Date.parse("2026-09-10T22:00:00Z"), "Asia/Tokyo"),
    "2026-09-11",
  );
});
test("Zone conversion uses DST rules for each occurrence and handles fractional offsets", () => {
  const raw = calendar(
    "DTSTART;TZID=America/Edmonton:20251027T110000\nDTEND;TZID=America/Edmonton:20251027T120000\nRRULE:FREQ=WEEKLY;COUNT=2",
  );
  const utc = T.project(raw, "UTC");
  assert.deepEqual(
    utc.events.map((e) => E.parts(e.start, "UTC").hour),
    ["17", "18"],
  );
  const india = T.project(raw, "Asia/Kolkata");
  assert.equal(E.parts(india.events[0].start, "Asia/Kolkata").minute, "30");
});
test("The zone picker includes Calgary, UTC, the saved zone, and an older-WebView fallback", () => {
  const supported = Intl.supportedValuesOf;
  try {
    Intl.supportedValuesOf = undefined;
    const zones = T.zones("Africa/Nairobi");
    for (const zone of [E.ZONE, "UTC", "Africa/Nairobi", "Pacific/Auckland"])
      assert.ok(zones.includes(zone));
  } finally {
    Intl.supportedValuesOf = supported;
  }
});
test("ABT stays at UTC−6 after November 2026, including on a WebView with old Alberta rules", () => {
  const filename = require.resolve("../app/src/main/assets/calendar.js");
  class OldDateTimeFormat extends Intl.DateTimeFormat {
    constructor(locale, options = {}) {
      super(locale, {
        ...options,
        timeZone:
          options.timeZone === E.ZONE ? "America/Denver" : options.timeZone,
      });
    }
  }
  const sandbox = {
    module: { exports: {} },
    require: createRequire(filename),
    Intl: { DateTimeFormat: OldDateTimeFormat },
  };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), sandbox);
  const old = sandbox.module.exports;
  for (const engine of [E, old]) {
    assert.equal(engine.parts(Date.parse("2026-11-02T17:00:00Z")).hour, "11");
    assert.equal(engine.parts(Date.parse("2027-01-10T17:00:00Z")).hour, "11");
    assert.equal(engine.parts(Date.parse("2027-07-10T17:00:00Z")).hour, "11");
    assert.equal(
      engine.dateKey(Date.parse("2026-11-02T06:30:00Z")),
      "2026-11-02",
    );
    assert.equal(engine.parts(Date.parse("2025-11-03T18:00:00Z")).hour, "11");
    const zoned = engine.parse(
      `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VTIMEZONE\nTZID:America/Edmonton\nBEGIN:STANDARD\nDTSTART:19701101T020000\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\nTZOFFSETFROM:-0600\nTZOFFSETTO:-0700\nEND:STANDARD\nBEGIN:DAYLIGHT\nDTSTART:19700308T020000\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\nTZOFFSETFROM:-0700\nTZOFFSETTO:-0600\nEND:DAYLIGHT\nEND:VTIMEZONE\nBEGIN:VEVENT\nUID:abt-class\nSUMMARY:Example class\nDTSTART;TZID=America/Edmonton:20261026T110000\nDTEND;TZID=America/Edmonton:20261026T120000\nRRULE:FREQ=WEEKLY;COUNT=3\nEND:VEVENT\nEND:VCALENDAR`,
    );
    assert.ok(
      zoned.events.every((e) => new Date(e.start).getUTCHours() === 17),
    );
    const floating = engine.parse(
      "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:floating\nDTSTART:20270110T110000\nDTEND:20270110T120000\nEND:VEVENT\nEND:VCALENDAR",
    );
    assert.equal(
      new Date(floating.events[0].start).toISOString(),
      "2027-01-10T17:00:00.000Z",
    );
  }
});
