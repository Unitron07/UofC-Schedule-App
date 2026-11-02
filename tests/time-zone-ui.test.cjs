const { chromium } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../app/src/main/assets");
const out = path.resolve(
  process.env.TEST_OUTPUT || path.join(__dirname, "../test-output"),
);
fs.mkdirSync(out, { recursive: true });
const fixture = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:late-class
DTSTART:20260910T233000Z
DTEND:20260911T003000Z
SUMMARY:CS 101 - Example class
LOCATION:Room 100
END:VEVENT
BEGIN:VEVENT
UID:all-day
DTSTART;VALUE=DATE:20260910
DTEND;VALUE=DATE:20260911
SUMMARY:All-day reminder
END:VEVENT
END:VCALENDAR`;
const server = http.createServer((req, res) => {
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
      timezoneId: "Pacific/Auckland",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date("2026-09-10T22:00:00Z"));
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page.evaluate((text) => {
      localStorage.setItem(
        "campusday.schedule.v1",
        JSON.stringify(CalendarEngine.parse(text)),
      );
    }, fixture);
    await page.reload();
    const saved = await page.evaluate(() =>
      localStorage.getItem("campusday.schedule.v1"),
    );
    assert.equal(await page.locator("#date-picker").inputValue(), "2026-09-10");
    assert.equal(await page.locator(".class-card").count(), 2);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const phoneSwitch = page.getByRole("switch", {
      name: "Use phone time zone",
    });
    assert.equal(await phoneSwitch.getAttribute("aria-checked"), "false");
    await page
      .getByLabel("Manual time zone", { exact: true })
      .selectOption("UTC");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    assert.match(await page.locator(".hero-meta").innerText(), /11:30 PM/);
    await page.reload();
    assert.equal(await page.locator(".time-zone-label").innerText(), "UTC+0");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await phoneSwitch.click();
    assert.equal(
      await page.getByLabel("Manual time zone", { exact: true }).isDisabled(),
      true,
    );
    assert.match(await page.locator("#sheet").innerText(), /Pacific\/Auckland/);
    await page.screenshot({ path: path.join(out, "time-zone-settings.png") });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    assert.equal(await page.locator("#date-picker").inputValue(), "2026-09-11");
    assert.equal(await page.locator(".class-card").count(), 1);
    assert.match(await page.locator(".hero-meta").innerText(), /11:30 AM/);
    // All-day events keep September 10 even though timed meetings moved to September 11.
    await page.locator("#date-picker").fill("2026-09-10");
    assert.equal(await page.locator(".class-card").count(), 1);
    assert.match(
      await page.locator(".class-card").innerText(),
      /All-day reminder/,
    );
    await page.evaluate(() => window.resumeSchedule());
    await page.getByRole("button", { name: "Week", exact: true }).click();
    const meeting = page
      .locator(".week-event")
      .filter({ hasText: "Example class" });
    assert.match(await meeting.innerText(), /11:30 AM/);
    await meeting.click();
    assert.match(await page.locator("#sheet").innerText(), /September 11/);
    // Simulate the Android bridge reporting a new zone while details are open.
    await page.evaluate(() => {
      window.Android = {
        timeZone: () => "Asia/Tokyo",
        systemDark: () => false,
        theme: () => {},
        haptic: () => {},
      };
      window.refreshClock();
    });
    assert.match(await page.locator("#sheet").innerText(), /Asia\/Tokyo/);
    assert.match(await page.locator("#sheet").innerText(), /8:30 AM/);
    await page
      .getByRole("button", { name: "Subject details", exact: true })
      .click();
    assert.match(
      await page.locator(".meeting-pattern").innerText(),
      /Fri · 8:30 AM/,
    );
    await page.evaluate(() => {
      Android.timeZone = () => "UTC";
      window.resumeSchedule();
    });
    assert.match(
      await page.locator(".meeting-pattern").innerText(),
      /Thu · 11:30 PM/,
    );
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    // Turning phone mode off restores the last manual choice.
    await phoneSwitch.click();
    assert.equal(
      await page.getByLabel("Manual time zone", { exact: true }).inputValue(),
      "UTC",
    );
    await page.evaluate(() => {
      Android.timeZone = () => "Asia/Tokyo";
      window.refreshClock();
    });
    assert.match(await page.locator("#sheet").innerText(), /Showing UTC/);
    await page
      .getByRole("switch", { name: "24-hour time", exact: true })
      .click();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page
      .getByRole("button", { name: "Today", exact: true })
      .last()
      .click();
    assert.match(await page.locator(".hero-meta").innerText(), /23:30/);
    // A phone clock correction updates current-class status without reopening.
    await page.clock.setFixedTime(new Date("2026-09-10T23:45:00Z"));
    await page.evaluate(() => window.resumeSchedule());
    assert.match(await page.locator(".hero").innerText(), /HAPPENING NOW/);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("campusday.schedule.v1")),
      saved,
    );
    await page.reload();
    assert.equal(await page.locator(".time-zone-label").innerText(), "UTC+0");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    for (const viewport of [
      { width: 320, height: 640 },
      { width: 780, height: 360 },
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.equal(
        await page
          .locator("#sheet")
          .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
        true,
      );
    }
    // Unsupported persisted zones recover safely on startup.
    await page.evaluate(() =>
      localStorage.setItem(
        "campusday.preferences.v1",
        JSON.stringify({ timeZone: "Invalid/Zone" }),
      ),
    );
    await page.reload();
    assert.equal(
      await page.locator(".time-zone-label").innerText(),
      "Calgary · MDT UTC−6",
    );
    await page.setViewportSize({ width: 360, height: 780 });
    await page.clock.setFixedTime(new Date("2027-01-10T16:00:00Z"));
    await page.evaluate(
      (text) => {
        localStorage.setItem(
          "campusday.schedule.v1",
          JSON.stringify(CalendarEngine.parse(text)),
        );
        localStorage.setItem(
          "campusday.preferences.v1",
          JSON.stringify({ hour24: true, timeZone: "America/Edmonton" }),
        );
      },
      fixture
        .replace("20260910T233000Z", "20270110T173000Z")
        .replace("20260911T003000Z", "20270110T183000Z")
        .replaceAll("20260910", "20270110")
        .replaceAll("20260911", "20270111"),
    );
    await page.reload();
    assert.equal(
      await page.locator(".time-zone-label").innerText(),
      "Calgary · ABT UTC−6",
    );
    assert.match(await page.locator(".hero-meta").innerText(), /11:30/);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByLabel("Manual time zone", { exact: true })
      .selectOption("Etc/GMT+6");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    assert.match(await page.locator(".hero-meta").innerText(), /11:30/);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.evaluate(() => {
      window.Android = {
        timeZone: () => "America/Edmonton",
        systemDark: () => false,
        theme: () => {},
        haptic: () => {},
      };
    });
    await phoneSwitch.click();
    assert.match(await page.locator("#sheet").innerText(), /ABT UTC−6/);
    await page.screenshot({ path: path.join(out, "time-zone-settings.png") });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: manual/device zones, date rollover, all-day dates, persistence, week/details/subjects, live device and clock changes, 24-hour format, safe fallback and compact layouts.",
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
