const { chromium } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const academicPage = require("./fixtures/academic-page.cjs");
const root = path.resolve(__dirname, "../app/src/main/assets"),
  out = path.resolve(
    process.env.TEST_OUTPUT || path.join(__dirname, "../test-output"),
  );
const fixture = fs.readFileSync(
  path.join(__dirname, "../examples/demo.ics"),
  "utf8",
);
fs.mkdirSync(out, { recursive: true });
let requests = [],
  fail = false;
const server = http.createServer((req, res) => {
  if (req.url === "/academic-calendar") {
    requests.push({ method: req.method, url: req.url });
    res.writeHead(fail ? 503 : 200, { "Content-Type": "text/html" });
    return res.end(fail ? "Unavailable" : academicPage());
  }
  const file = path.resolve(
    root,
    "." + (req.url === "/" ? "/index.html" : req.url),
  );
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader(
    "Content-Type",
    file.endsWith(".js")
      ? "application/javascript"
      : file.endsWith(".css")
        ? "text/css"
        : "text/html",
  );
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 360, height: 780 },
      deviceScaleFactor: 2,
      timezoneId: "Pacific/Auckland",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date("2027-09-09T21:14:59Z"));
    await page.goto("http://127.0.0.1:" + server.address().port);
    assert.equal(requests.length, 0);
    await page.evaluate(
      (text) => window.receiveCalendar(text, "example.ics"),
      fixture,
    );
    assert.equal(requests.length, 0);
    await page.getByRole("button", { name: "Let’s see my day" }).click();
    await page.waitForFunction(() =>
      localStorage.getItem("campusday.academic-dates.v1"),
    );
    await page
      .getByRole("button", { name: "Skip for now", exact: true })
      .click();
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0], { method: "GET", url: "/academic-calendar" });
    assert.equal(await page.locator("#date-picker").inputValue(), "2027-09-09");
    await page.clock.setFixedTime(new Date("2027-09-09T21:15:00Z"));
    await page.evaluate(() => window.refreshClock());
    assert.equal(await page.locator("#date-picker").inputValue(), "2027-09-10");
    await page.screenshot({ path: path.join(out, "next-day.png") });
    await page
      .getByRole("button", { name: "Today", exact: true })
      .first()
      .click();
    assert.equal(await page.locator("#date-picker").inputValue(), "2027-09-09");
    await page.evaluate(() => window.refreshClock());
    assert.equal(await page.locator("#date-picker").inputValue(), "2027-09-09");
    await page.evaluate(() => window.resumeSchedule());
    assert.equal(await page.locator("#date-picker").inputValue(), "2027-09-10");
    await page.reload();
    assert.equal(await page.locator("#date-picker").inputValue(), "2027-09-10");
    assert.equal(requests.length, 1);
    await page.clock.setFixedTime(new Date("2027-09-10T06:00:00Z"));
    await page.evaluate(() => window.refreshClock());
    assert.equal(await page.locator("#date-picker").inputValue(), "2027-09-10");
    await page.locator("#date-picker").fill("2026-09-30");
    assert.match(
      await page.locator(".empty-day").innerText(),
      /National Day for Truth and Reconciliation/,
    );
    await page.screenshot({ path: path.join(out, "holiday.png") });
    await page.getByRole("button", { name: "Week", exact: true }).click();
    assert.match(
      await page.locator("main").innerText(),
      /National Day for Truth and Reconciliation/,
    );
    await page
      .getByRole("button", { name: "Today", exact: true })
      .last()
      .click();
    await page.locator("#date-picker").fill("2026-11-11");
    assert.match(
      await page.locator(".empty-day").innerText(),
      /Remembrance Day/,
    );
    assert.match(
      await page.locator(".empty-day").innerText(),
      /Fall term break/,
    );
    await page.locator("#date-picker").fill("2026-11-09");
    assert.equal(
      await page.locator(".empty-day h2").innerText(),
      "Fall term break",
    );
    await page.screenshot({ path: path.join(out, "term-break.png") });
    const cached = await page.evaluate(() =>
      localStorage.getItem("campusday.academic-dates.v1"),
    );
    fail = true;
    await page.evaluate(
      (text) => window.receiveCalendar(text, "updated.ics"),
      fixture,
    );
    await page
      .getByRole("button", { name: "Replace timetable", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector("[data-academic-status]")
        ?.textContent.includes("Couldn’t refresh"),
    );
    assert.equal(requests.length, 2);
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("campusday.academic-dates.v1"),
      ),
      cached,
    );
    await page
      .getByRole("button", { name: "Skip for now", exact: true })
      .click();
    // A holiday never deletes a meeting actually present in the imported file.
    const holidayFixture = fixture
      .replaceAll("20270909", "20260930")
      .replaceAll("COUNT=12", "COUNT=1");
    await page.clock.setFixedTime(new Date("2026-09-30T16:00:00Z"));
    await page.evaluate(
      (text) => window.receiveCalendar(text, "special-meetings.ics"),
      holidayFixture,
    );
    await page
      .getByRole("button", { name: "Replace timetable", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Skip for now", exact: true })
      .click();
    assert.equal(await page.locator(".class-card").count(), 3);
    assert.match(
      await page.locator(".academic-notice").innerText(),
      /National Day for Truth and Reconciliation/,
    );
    // A screenshot with a fictional timetable in the same term as the holiday.
    await page.evaluate(
      (text) => {
        localStorage.removeItem("campusday.academic-dates.v1");
        localStorage.setItem(
          "campusday.schedule.v1",
          JSON.stringify(CalendarEngine.parse(text)),
        );
      },
      fixture.replaceAll("20270909", "20260903"),
    );
    await page.reload();
    assert.equal(
      await page.locator(".empty-day h2").innerText(),
      "National Day for Truth and Reconciliation",
    );
    await page.screenshot({ path: path.join(out, "holiday.png") });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: exact end-time rollover, reopen/resume, manual dates, midnight, holiday/break labels, import-only GET refresh, offline cache and meeting preservation.",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
