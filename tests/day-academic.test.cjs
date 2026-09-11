const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const D = require("../app/src/main/assets/day-default.js"),
  A = require("../app/src/main/assets/academic.js"),
  fixture = require("./fixtures/academic-page.cjs");
const now = (s) => Date.parse(s);
const schedule = {
  events: [
    { day: "2026-09-10", end: now("2026-09-10T21:00:00Z") },
    { day: "2026-09-10", end: now("2026-09-10T18:00:00Z") },
  ],
};
test("Defaults change at the last end time, never between classes", () => {
  assert.equal(
    D.defaultDay(schedule, now("2026-09-10T18:01:00Z")),
    "2026-09-10",
  );
  assert.equal(
    D.defaultDay(schedule, now("2026-09-10T20:59:59Z")),
    "2026-09-10",
  );
  assert.equal(
    D.defaultDay(schedule, now("2026-09-10T21:00:00Z")),
    "2026-09-11",
  );
  assert.equal(
    D.defaultDay(schedule, now("2026-09-11T06:00:00Z")),
    "2026-09-11",
  );
});
test("No-class days remain today; next day does not skip weekends", () => {
  assert.equal(
    D.defaultDay(schedule, now("2026-09-12T21:00:00Z")),
    "2026-09-12",
  );
  assert.equal(
    D.defaultDay(
      { events: [{ day: "2026-09-11", end: now("2026-09-11T21:00:00Z") }] },
      now("2026-09-11T22:00:00Z"),
    ),
    "2026-09-12",
  );
  assert.equal(D.defaultDay(null, now("2026-09-10T23:00:00Z")), "2026-09-10");
});
test("All-day events, DST, month and year boundaries use Calgary dates", () => {
  assert.equal(
    D.defaultDay(
      {
        events: [
          { day: "2026-09-10", allDay: true, end: now("2026-09-11T06:00:00Z") },
        ],
      },
      now("2026-09-11T05:59:59Z"),
    ),
    "2026-09-10",
  );
  for (const [day, end, result] of [
    ["2026-12-31", "2026-12-31T22:00:00Z", "2027-01-01"],
    ["2026-09-30", "2026-09-30T21:00:00Z", "2026-10-01"],
    ["2026-11-01", "2026-11-01T22:00:00Z", "2026-11-02"],
  ])
    assert.equal(
      D.defaultDay({ events: [{ day, end: now(end) }] }, now(end)),
      result,
    );
});
test("Published dates take precedence over draft widgets", () => {
  const data = A.parsePage(fixture(), 1234);
  assert.equal(
    A.forDay(data, "2026-09-30").title,
    "National Day for Truth and Reconciliation",
  );
  assert.equal(A.forDay(data, "2026-09-29"), null);
  assert.equal(A.forDay(data, "2026-11-11").title, "Remembrance Day");
  assert.match(A.forDay(data, "2026-11-11").detail, /Fall term break/);
  assert.equal(A.forDay(data, "2026-11-14").title, "Fall term break");
  assert.equal(A.forDay(data, "2026-11-15"), null);
  assert.equal(A.forDay(data, "2027-02-20").title, "Winter term break");
  assert.equal(A.forDay(data, "2026-12-31").title, "Holiday Observance");
  assert.equal(A.forDay(data, "2027-01-01").title, "New Year's Day");
});
test("Refresh replaces changed dates and retains older years", () => {
  const old = A.parsePage(fixture(), 100),
    next = A.parsePage(fixture({ holidayDay: 29 }), 200),
    merged = A.merge(old, next);
  assert.equal(A.forDay(merged, "2026-09-30"), null);
  assert.ok(A.forDay(merged, "2026-09-29"));
  const future = A.merge(old, A.parsePage(fixture({ year: 2028 }), 300));
  assert.ok(A.forDay(future, "2026-09-30"));
  assert.ok(A.forDay(future, "2028-09-30"));
});
test("Invalid source fails instead of inventing dates", () => {
  assert.throws(() => A.parsePage("<html>Unavailable</html>"));
  assert.throws(() =>
    A.parsePage(fixture().replace("September 30", "September 99")),
  );
  assert.throws(() => A.parsePage("x".repeat(2097153)));
  assert.equal(A.valid({}), false);
});
test("Failed refresh keeps cache; success persists only date data", async () => {
  const snapshot = A.parsePage(fixture(), 100),
    store = new Map();
  let response = fixture({ holidayDay: 29 }),
    ok = true,
    calls = [];
  const context = {
    window: { AcademicCalendar: A, BUNDLED_ACADEMIC_DATES: snapshot },
    localStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, v),
    },
    document: { querySelectorAll: () => [] },
    Intl,
    Date,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok, text: async () => response };
    },
  };
  vm.runInNewContext(
    fs.readFileSync(
      require.resolve("../app/src/main/assets/academic-state.js"),
      "utf8",
    ),
    context,
  );
  const state = context.window.AcademicDates;
  assert.equal(calls.length, 0);
  await state.refresh();
  assert.equal(calls[0].url, "/academic-calendar");
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(state.forDay("2026-09-30"), null);
  assert.ok(state.forDay("2026-09-29"));
  const saved = store.get("campusday.academic-dates.v1");
  assert.ok(saved);
  assert.ok(!saved.includes("widgets"));
  ok = false;
  await state.refresh();
  assert.equal(store.get("campusday.academic-dates.v1"), saved);
  assert.match(state.summary(), /Couldn’t refresh/);
  ok = true;
  response = "broken page";
  await state.refresh();
  assert.equal(store.get("campusday.academic-dates.v1"), saved);
  assert.ok(state.forDay("2026-09-29"));
});
