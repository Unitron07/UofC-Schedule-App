const { chromium } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../app/src/main/assets"),
  out = path.resolve(
    process.env.TEST_OUTPUT || path.join(__dirname, "../test-output"),
  );
const fixture = fs.readFileSync(
  path.join(__dirname, "../examples/demo.ics"),
  "utf8",
);
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    "." + (req.url === "/" ? "/index.html" : req.url.split("?")[0]),
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
      isMobile: true,
      hasTouch: true,
      timezoneId: "America/Edmonton",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date("2027-09-09T16:45:00Z"));
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page
      .getByRole("button", { name: "Import timetable", exact: true })
      .waitFor();
    await page.locator("#file-input").setInputFiles({
      name: "demo.ics",
      mimeType: "text/calendar",
      buffer: Buffer.from(fixture),
    });
    await page.getByRole("button", { name: "Let’s see my day" }).click();
    const enhanced = fs.existsSync(path.join(root, "courses.js"));
    if (enhanced) {
      await page
        .getByRole("button", { name: "Skip for now", exact: true })
        .waitFor();
      assert.equal(await page.locator("#sheet .course-row").count(), 2);
      await page.screenshot({ path: path.join(out, "import-setup.png") });
      await page
        .locator("#sheet .course-row")
        .filter({ hasText: "CS 101" })
        .click();
      await page
        .getByLabel("Course instructor", { exact: true })
        .fill("Example Instructor");
      await page
        .getByLabel("Office / office hours", { exact: true })
        .fill("Learning Centre 210 · Mondays 2–3 PM");
      await page.getByLabel("Notes", { exact: true }).fill("Bring a notebook.");
      await page
        .getByRole("button", { name: "Save and continue", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Skip for now", exact: true })
        .click();
    }
    assert.equal(await page.locator(".class-card").count(), 3);
    await page.reload();
    await page.screenshot({ path: path.join(out, "daily.png") });
    await page.reload();
    assert.equal(await page.locator(".class-card").count(), 3);
    await page.getByRole("button", { name: "Week", exact: true }).click();
    assert.equal(await page.locator(".week-event").count(), 3);
    await page.screenshot({ path: path.join(out, "week.png") });
    await page.getByRole("button", { name: "Timetable", exact: true }).click();
    assert.equal(await page.locator(".course-row").count(), 2);
    if (enhanced) {
      await page.getByRole("searchbox").fill("CS 101");
      await page.locator(".course-row").click();
      const text = await page.locator("#sheet").innerText();
      assert.ok(
        text.includes("Example Instructor") &&
          text.includes("Computing Lab 3") &&
          text.includes("Lab"),
      );
      await page.screenshot({ path: path.join(out, "subject.png") });
      await page
        .getByRole("button", { name: "Edit subject details", exact: true })
        .click();
      const lab = page
        .locator("fieldset")
        .filter({ has: page.locator("legend", { hasText: "B01" }) });
      await lab.getByRole("combobox").selectOption("Seminar");
      await lab
        .getByLabel("Instructor / TA for this section", { exact: true })
        .fill("Example TA");
      await page
        .getByLabel("Notes", { exact: true })
        .fill("<img src=x onerror=alert(1)>");
      await page
        .getByRole("button", { name: "Save details", exact: true })
        .click();
      assert.ok(
        (await page.locator("#sheet").innerText()).includes("Example TA"),
      );
      assert.equal(await page.locator("#sheet img").count(), 0);
      await page.getByRole("button", { name: "Close", exact: true }).click();
    }
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    if (enhanced) {
      assert.equal(await page.locator(".accent-option").count(), 5);
      await page.getByRole("button", { name: "Lavender", exact: true }).click();
      await page.screenshot({ path: path.join(out, "appearance.png") });
    }
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.reload();
    assert.equal(
      await page.locator("html").getAttribute("data-theme"),
      "light",
    );
    await page.evaluate(
      (t) => window.receiveCalendar(t, "demo-updated.ics"),
      fixture,
    );
    await page
      .getByRole("button", { name: "Replace timetable", exact: true })
      .click();
    if (enhanced) {
      await page
        .getByRole("button", { name: "Skip for now", exact: true })
        .click();
      assert.ok(
        await page.evaluate(() =>
          Object.values(
            JSON.parse(localStorage.getItem("campusday.course-details.v1")),
          ).some((c) => c.instructor === "Example Instructor"),
        ),
      );
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("campusday.preferences.v1")).accent,
        ),
        "lilac",
      );
    }
    assert.equal(await page.locator(".class-card").count(), 3);
    await page.evaluate(() => window.receiveCalendar("invalid", "invalid.ics"));
    await page.getByRole("button", { name: "Choose another file" }).waitFor();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("campusday.schedule.v1")).events
            .length,
      ),
      36,
    );
    await page.getByRole("button", { name: "Close", exact: true }).click();
    for (const size of [
      { width: 320, height: 640 },
      { width: 384, height: 780 },
      { width: 780, height: 360 },
    ]) {
      await page.setViewportSize(size);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      assert.ok(
        await page.evaluate(
          () =>
            document.querySelector("#sheet").scrollWidth <=
            document.querySelector("#sheet").clientWidth + 1,
        ),
      );
      await page.getByRole("button", { name: "Close", exact: true }).click();
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: import, persistence, views, optional setup/edit/skip, safe text, accents, replacement, invalid input, responsive layout.",
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
