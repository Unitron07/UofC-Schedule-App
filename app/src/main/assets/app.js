"use strict";
const E = CalendarEngine;
const $ = (s) => document.querySelector(s);
const escapeHTML = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  calendar:
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M8 14h2M14 14h2M8 18h2",
  sun: "M12 3v1M12 20v1M3 12h1M20 12h1M5.6 5.6l.7.7M17.7 17.7l.7.7M5.6 18.4l.7-.7M17.7 6.3l.7-.7M16 12a4 4 0 1 1-8 0a4 4 0 0 1 8 0",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  book: "M4 3h13a2 2 0 0 1 2 2v16H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3M3 17h16M7 7h7M7 11h5",
  settings:
    "M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8M9 3h6l.7 3 2.6 1.5 2.9-.9 3 5.2-2.2 2.1v3l2.2 2.1-3 5.2-2.9-.9-2.6 1.5-.7 3H9l-.7-3-2.6-1.5-2.9.9-3-5.2L2 16v-3l-2.2-2.1 3-5.2 2.9.9L8.3 5z",
  sliders: "M4 7h7M15 7h5M4 17h3M11 17h9M11 4v6M7 14v6",
  upload: "M12 16V3M7 8l5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0M15 10a3 3 0 1 1-6 0a3 3 0 0 1 6 0",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0a10 10 0 0 1 20 0",
  right: "M9 5l7 7-7 7",
  left: "M15 5l-7 7 7 7",
  down: "M6 9l6 6 6-6",
  close: "M6 6l12 12M6 18L18 6",
  check: "M5 12l4 4L19 6",
  shield: "M12 2l8 3v6c0 5-8 11-8 11S4 16 4 11V5l8-3M8 11l3 3 5-6",
  coffee:
    "M4 9h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9M16 10h2a3 3 0 0 1 0 6h-2M7 3v3M12 3v3M2 22h17",
  arrow: "M5 12h14M13 6l6 6-6 6",
  file: "M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9l-7-7M14 2v7h7M7 14h10M7 18h7",
  search: "M11 3a8 8 0 1 1 0 16a8 8 0 0 1 0-16M17 17l5 5",
  leaf: "M20 3c-14-2-20 13-9 17 7 3 12-8 9-17M5 22L16 8",
  info: "M12 11v6M12 7v.1M22 12a10 10 0 1 1-20 0a10 10 0 0 1 20 0",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.calendar}"/></svg>`;
let schedule = null,
  prefs = { theme: "dark", hour24: false, accent: "sky" },
  selected = E.dateKey(Date.now()),
  tab = "day",
  search = "",
  pending = null,
  previousFocus = null;
const storageKey = "campusday.schedule.v1";
const detailsKey = "campusday.course-details.v1";
let courseDetails = {};
try {
  const stored = JSON.parse(localStorage.getItem(detailsKey) || "{}");
  if (stored && typeof stored === "object" && !Array.isArray(stored))
    courseDetails = stored;
} catch (e) {}
function courseTitles() {
  return schedule.courses;
}
function courseInfo(title) {
  return Courses.info(
    schedule.events.find((e) => e.title === title) || { title, id: "" },
    courseDetails,
  );
}
function sessionInfo(e) {
  return Courses.session(e, courseDetails);
}
function nameOf(e) {
  return courseInfo(e.title).name;
}
function codeLabel(e) {
  const c = courseInfo(e.title);
  return c.code ? '<span class="course-code">' + esc(c.code) + "</span>" : "";
}
function typeLabel(e) {
  const c = sessionInfo(e);
  return c.type + (c.section ? " · " + c.section : "");
}

try {
  schedule = JSON.parse(localStorage.getItem(storageKey));
  if (
    schedule &&
    (!Array.isArray(schedule.events) ||
      !Array.isArray(schedule.courses) ||
      schedule.version !== 1)
  )
    schedule = null;
  prefs = {
    ...prefs,
    ...JSON.parse(localStorage.getItem("campusday.preferences.v1") || "{}"),
  };
} catch (e) {
  schedule = null;
}
let lastToday = E.dateKey(Date.now());
const today = () => E.dateKey(Date.now());
const dateObj = (key) => new Date(key + "T12:00:00Z");
function addDays(key, n) {
  const d = dateObj(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function monday(key) {
  const d = dateObj(key).getUTCDay();
  return addDays(key, -((d + 6) % 7));
}
function dateText(key, opts = { month: "long", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-CA", { ...opts, timeZone: "UTC" }).format(
    dateObj(key),
  );
}
function time(ms, short = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: E.ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: !prefs.hour24,
  })
    .format(new Date(ms))
    .replace(short ? /\s[AP]M$/ : /^$/, "");
}
function duration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60
    ? `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}`
    : `${m} min`;
}
function color(title) {
  let i = schedule ? courseTitles().indexOf(title) : 0;
  return `var(--c${Math.max(0, i) % 4})`;
}
function room(location) {
  return location.includes(" - ")
    ? location.split(" - ").slice(-1)[0]
    : location;
}
function dayEvents(key) {
  return schedule
    ? schedule.events.filter(
        (e) => e.day === key || (e.day < key && E.dateKey(e.end - 1) >= key),
      )
    : [];
}
function timeRange(e) {
  return e.allDay ? "All day" : `${time(e.start)} – ${time(e.end)}`;
}
function esc(v) {
  return escapeHTML(v);
}
function haptic() {
  window.Android?.haptic();
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 3500);
}
const accents = {
  sky: {
    label: "Blue",
    fill: "#b5d8fa",
    ink: "#182d43",
    text: "#315d83",
    dark: ["#b9c5fa", "#b1dce9", "#a7cdef", "#cec5ed"],
    light: ["#536299", "#386877", "#37658c", "#6e5888"],
  },
  lilac: {
    label: "Lavender",
    fill: "#d6c6f6",
    ink: "#302347",
    text: "#675087",
    dark: ["#d0b8ef", "#bcbef4", "#e3bedd", "#c5cef6"],
    light: ["#70528e", "#565b95", "#8a527e", "#526597"],
  },
  rose: {
    label: "Rose",
    fill: "#f3bfce",
    ink: "#452532",
    text: "#914a61",
    dark: ["#ecc0d5", "#f1b8b3", "#d9b8e6", "#f1c4ab"],
    light: ["#875773", "#925752", "#7b578d", "#8b654d"],
  },
  sand: {
    label: "Sand",
    fill: "#f0d2a4",
    ink: "#3d2e18",
    text: "#7e6030",
    dark: ["#eacfa5", "#e9bfa6", "#dbccb0", "#efc29c"],
    light: ["#80613c", "#8d5d40", "#74674e", "#8e653f"],
  },
  sage: {
    label: "Green",
    fill: "#d3edab",
    ink: "#213016",
    text: "#426426",
    dark: ["#c3c0f4", "#e7bf96", "#b5dabf", "#a7cddf"],
    light: ["#666296", "#996438", "#447e55", "#3e758e"],
  },
};
function accentPicker() {
  return (
    '<p class="eyebrow" style="margin-top:24px">ACCENT COLOR</p><div class="accent-picker" role="group" aria-label="Accent color">' +
    Object.entries(accents)
      .map(
        ([key, a]) =>
          '<button class="accent-option ' +
          (prefs.accent === key ? "selected" : "") +
          '" data-action="accent" data-value="' +
          key +
          '" aria-pressed="' +
          (prefs.accent === key) +
          '"><span style="background:' +
          a.fill +
          ";color:" +
          a.ink +
          '">' +
          (prefs.accent === key ? icon("check") : "") +
          "</span>" +
          a.label +
          "</button>",
      )
      .join("") +
    "</div>"
  );
}
function applyTheme() {
  const systemDark = window.Android
    ? Android.systemDark()
    : matchMedia("(prefers-color-scheme: dark)").matches;
  const theme =
    prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;
  document.documentElement.dataset.theme = theme;
  const a = accents[prefs.accent] || accents.sky;
  const style = document.documentElement.style;
  style.setProperty("--accent", a.fill);
  style.setProperty("--accent-ink", a.ink);
  style.setProperty("--accent-text", a.text);
  a[theme === "light" ? "light" : "dark"].forEach((value, i) =>
    style.setProperty("--c" + i, value),
  );
  window.Android?.theme(theme);
}
function savePrefs() {
  try {
    localStorage.setItem("campusday.preferences.v1", JSON.stringify(prefs));
  } catch (e) {
    toast("Could not save preferences. Your device may be low on storage.");
  }
  applyTheme();
}
function topbar() {
  return `<header class="topbar"><div class="brand"><span class="brand-mark">${icon("calendar")}</span>Campus Day</div><button class="icon-button" data-action="settings" aria-label="Settings">${icon("sliders")}</button></header>`;
}
function navbar() {
  return `<nav class="bottom-nav" aria-label="Main navigation">${[
    ["day", "sun", "Today"],
    ["week", "grid", "Week"],
    ["timetable", "book", "Timetable"],
  ]
    .map(
      ([id, i, label]) =>
        `<button class="nav-button ${tab === id ? "active" : ""}" data-action="tab" data-value="${id}" ${tab === id ? 'aria-current="page"' : ""}><span class="nav-icon">${icon(i)}</span>${label}</button>`,
    )
    .join("")}</nav>`;
}
function render() {
  $("#app").innerHTML =
    topbar() +
    (schedule
      ? tab === "day"
        ? renderDay()
        : tab === "week"
          ? renderWeek()
          : renderTimetable()
      : renderWelcome()) +
    (schedule ? navbar() : "");
  applyTheme();
}
function renderWelcome() {
  return `<main class="welcome"><div class="welcome-visual" aria-hidden="true"><div class="orbit"></div><div class="mini-calendar"><div class="mini-top"><span>YOUR WEEK, SIMPLIFIED</span>${icon("calendar")}</div><div class="mini-days"><span>14</span><span>15</span><span class="highlight">16</span><span>17</span><span>18</span></div><div class="mini-class"></div><div class="mini-class two"></div></div><div class="float-badge">${icon("check")} A little more headspace.</div></div><p class="eyebrow">LESS CHECKING. MORE LIVING.</p><h1 style="margin-top:12px">Your day.<br>Your own rhythm.</h1><p class="intro">All your classes, one quiet place. Bring in your university calendar and let the day fall into place.</p><button class="primary" data-action="import">${icon("upload")}Import timetable</button><div class="privacy-line">${icon("shield")} On your phone. Offline. Always yours.</div><button class="text-button" data-action="help">Where do I get my calendar file?</button></main>`;
}
function dateHeader(title, kicker) {
  return `<div class="heading"><p class="eyebrow">${esc(kicker)}</p><div class="heading-line"><h1>${esc(title)}</h1>${selected !== today() ? '<button class="today-pill" data-action="today">Today</button>' : ""}</div><label class="date-label">${esc(dateText(selected, { weekday: "long", month: "long", day: "numeric" }))}${icon("down")}<input type="date" id="date-picker" aria-label="Choose a date" value="${selected}" min="1900-01-01" max="2199-12-31"></label></div>`;
}
function weekSelector() {
  const start = monday(selected);
  return `<div class="week-selector" role="group" aria-label="Choose a day">${Array.from(
    { length: 7 },
    (_, i) => {
      const d = addDays(start, i);
      return `<button class="day-button ${d === selected ? "selected" : ""} ${d === today() ? "is-today" : ""} ${dayEvents(d).length ? "has-events" : ""}" data-action="date" data-value="${d}" aria-label="${esc(dateText(d, { weekday: "long", month: "long", day: "numeric" }))}" aria-pressed="${d === selected}"><span class="dow">${dateText(d, { weekday: "short" }).slice(0, 3).toUpperCase()}</span><span class="num">${+d.slice(-2)}</span><span class="dot"></span></button>`;
    },
  ).join("")}</div>`;
}
function hero(events) {
  const now = Date.now(),
    isToday = selected === today();
  const next = events.find((e) => !e.allDay && e.end > now);
  const e = isToday ? next : events.find((e) => !e.allDay) || events[0];
  if (!e) return "";
  const live = isToday && e.start <= now && e.end > now;
  const wait = Math.ceil((e.start - now) / 60000);
  const badge = live
    ? `${duration(e.end - now)} left`
    : isToday
      ? wait < 60
        ? `In ${wait} min`
        : `In ${duration(e.start - now)}`
      : e.allDay
        ? "All day"
        : time(e.start);
  return `<section class="hero" aria-label="${live ? "Current class" : "Next class"}"><div class="hero-top"><span class="live-label"><span class="live-dot"></span>${live ? "HAPPENING NOW" : isToday ? "UP NEXT" : "FIRST ON YOUR DAY"}</span><span class="badge">${esc(badge)}</span></div>${codeLabel(e)}<h2>${esc(nameOf(e))}</h2><p class="hero-type">${esc(typeLabel(e))}</p><div class="hero-meta"><span>${icon("clock")}${esc(timeRange(e))}</span><span>${icon("pin")}${esc(room(e.location))}</span></div>${live ? `<div class="progress-track" role="progressbar" aria-label="Class progress" aria-valuenow="${Math.round(((now - e.start) / (e.end - e.start)) * 100)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, ((now - e.start) / (e.end - e.start)) * 100))}%"></div></div>` : ""}</section>`;
}
function classCard(e) {
  const now = Date.now(),
    past = e.end < now,
    live = e.start <= now && e.end > now;
  return `<div class="agenda-row"><div class="time-rail">${e.allDay ? "All day" : esc(time(e.start, true))}<span class="end-time">${e.allDay ? "" : esc(time(e.end, true))}</span></div><button class="class-card ${past ? "past" : ""} ${live ? "ongoing" : ""}" style="--course:${color(e.title)}" data-action="detail" data-value="${esc(e.id)}" aria-label="${esc((courseInfo(e.title).code + " " + nameOf(e)).trim() + ", " + typeLabel(e) + ", " + timeRange(e) + ", " + e.location)}"><div class="course-label"><span>${esc(typeLabel(e))}</span><span>${live ? "IN CLASS" : past ? "FINISHED" : ""}</span></div>${codeLabel(e)}<h3>${esc(nameOf(e))}</h3><div class="card-footer"><span class="room">${icon("pin")}${esc(room(e.location))}</span>${icon("right")}</div></button></div>`;
}
function renderDay() {
  const events = dayEvents(selected),
    now = Date.now();
  const isToday = selected === today();
  const total = events
    .filter((e) => !e.allDay)
    .reduce((s, e) => s + e.end - e.start, 0);
  const finished =
    events.length && events.every((e) => e.end <= now) && isToday;
  return `<main>${dateHeader(isToday ? "Your day, at a glance." : dateText(selected, { weekday: "long" }) + ".", schedule.name.replace(/^Class Calendar\s*-?\s*/i, ""))}${weekSelector()}${hero(events)}${
    !events.length
      ? emptyDay()
      : `<div class="section-head"><h2>${isToday ? "Today’s agenda" : "Day’s agenda"}</h2><small>${events.length} ${events.length === 1 ? "class" : "classes"} · ${duration(total)}</small></div><div class="agenda">${events
          .map((e, i) => {
            let html = classCard(e),
              n = events[i + 1];
            if (n && !e.allDay && !n.allDay) {
              const gap = n.start - e.end;
              if (gap >= 15 * 60000)
                html += `<div class="break-row">${icon("coffee")}${duration(gap)} to recharge</div>`;
              else if (gap < 0)
                html += `<div class="break-row overlap">${icon("info")}These classes overlap</div>`;
            }
            return html;
          })
          .join(
            "",
          )}</div><div class="day-footer">${icon(finished ? "check" : "leaf")}${finished ? "All done. The rest of the day is yours." : `Your day wraps up at ${esc(time(Math.max(...events.map((e) => e.end))))}.`}</div>`
  }</main>`;
}
function emptyDay() {
  const next = schedule.events.find((e) => e.day > selected);
  const outside = selected < schedule.first || selected > schedule.last;
  return `<section class="empty-day"><div class="empty-symbol">${icon("leaf")}</div><h2>${outside ? "No classes in this date range." : "A little breathing room."}</h2><p>${outside ? `Your imported timetable covers ${esc(dateText(schedule.first))} – ${esc(dateText(schedule.last, { month: "long", day: "numeric", year: "numeric" }))}.` : "Nothing is scheduled for this day. Enjoy the space in between."}</p>${next ? `<button class="secondary" data-action="date" data-value="${next.day}">Next class · ${esc(dateText(next.day, { month: "short", day: "numeric" }))}${icon("arrow")}</button>` : '<button class="secondary" data-action="import">Import a new timetable</button>'}</section>`;
}
function renderWeek() {
  const start = monday(selected),
    end = addDays(start, 6),
    weekEvents = schedule.events.filter((e) => e.day >= start && e.day <= end);
  return `<main><div class="heading"><p class="eyebrow">MAKE ROOM FOR YOUR WEEK</p><div class="heading-line"><h1>The week ahead.</h1><button class="today-pill" data-action="today">This week</button></div><p class="muted" style="font-size:13px;margin-top:10px">${weekEvents.length} sessions. One clear picture.</p></div><div class="week-controls"><button class="icon-button" data-action="shift-week" data-value="-7" aria-label="Previous week">${icon("left")}</button><strong>${esc(dateText(start, { month: "short", day: "numeric" }))} – ${esc(dateText(end, { month: "short", day: "numeric" }))}</strong><button class="icon-button" data-action="shift-week" data-value="7" aria-label="Next week">${icon("right")}</button></div>${Array.from(
    { length: 7 },
    (_, i) => {
      const d = addDays(start, i),
        events = dayEvents(d);
      return `<section><div class="week-day-title"><h3>${esc(dateText(d, { weekday: "long" }))}${d === today() ? "<em>TODAY</em>" : ""}</h3><span>${esc(dateText(d, { month: "short", day: "numeric" }))}</span></div>${events.length ? events.map((e) => `<button class="week-event" data-action="detail" data-value="${esc(e.id)}" style="--course:${color(e.title)}"><span class="swatch"></span><div class="event-main">${codeLabel(e)}<h3>${esc(nameOf(e))}</h3><p>${esc(typeLabel(e))} · ${esc(room(e.location))}</p></div><div class="event-time">${e.allDay ? "All day" : esc(time(e.start))}<span>${e.allDay ? "" : esc(time(e.end))}</span></div></button>`).join("") : '<p class="free-day">No classes. A day to make your own.</p>'}</section>`;
    },
  ).join("")}</main>`;
}
function courseRows() {
  const courses = courseTitles().filter((c) => {
    const info = courseInfo(c);
    return (info.code + " " + info.name + " " + c)
      .toLowerCase()
      .includes(search.toLowerCase());
  });
  return courses.length
    ? courses
        .map((c) => {
          const es = schedule.events.filter((e) => e.title === c),
            info = courseInfo(c);
          return (
            '<button class="course-row" data-action="subject" data-value="' +
            esc(c) +
            '" style="--course:' +
            color(c) +
            '"><span class="course-dot"></span><div class="subject-row-main">' +
            (info.code
              ? '<span class="course-code">' + esc(info.code) + "</span>"
              : "") +
            "<h3>" +
            esc(info.name) +
            "</h3><p>" +
            (info.online
              ? "Online · No scheduled meetings"
              : es.length +
                " sessions · " +
                new Set(es.map((e) => e.location)).size +
                " rooms") +
            "</p></div>" +
            icon("right") +
            "</button>"
          );
        })
        .join("")
    : '<p class="notice">No matching subjects.</p>';
}
function renderTimetable() {
  return `<main><div class="heading"><p class="eyebrow">A PLACE FOR EVERYTHING</p><h1 style="margin-top:8px">Your timetable.</h1></div><section class="summary-panel"><div class="file-mark">${icon("calendar")}</div><h2>${esc(schedule.name.replace(/^Class Calendar\s*-?\s*/i, ""))}</h2><p>${esc(dateText(schedule.first, { month: "short", day: "numeric" }))} – ${esc(dateText(schedule.last, { month: "short", day: "numeric", year: "numeric" }))}</p><div class="stats"><div class="stat"><strong>${courseTitles().length}</strong><span>SUBJECTS</span></div><div class="stat"><strong>${schedule.events.length}</strong><span>SESSIONS</span></div></div><button class="primary" data-action="import">${icon("upload")}Import updated calendar</button><p style="text-align:center;margin-top:13px;font-size:10px">Imported ${esc(new Intl.DateTimeFormat("en-CA", { timeZone: E.ZONE, month: "short", day: "numeric" }).format(new Date(schedule.importedAt)))} · Saved on this phone</p></section><div class="section-head"><h2>Your subjects</h2><small>${courseTitles().length} total</small></div><label class="search">${icon("search")}<input id="course-search" type="search" placeholder="Find a subject" aria-label="Find a subject" value="${esc(search)}"></label><div id="course-list">${courseRows()}</div><p class="notice">Calendar times stay in Calgary time, even when you travel. Changes at university appear here after you import a fresh calendar.${schedule.bounded ? " Open-ended events are included for two years." : ""}</p><button class="secondary" data-action="help">${icon("info")}How to update your timetable</button></main>`;
}
function showSheet(title, body) {
  const dialog = $("#sheet");
  previousFocus = document.activeElement;
  dialog.innerHTML = `<div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2><button class="icon-button" data-action="close" aria-label="Close">${icon("close")}</button></div>${body}`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
function closeSheet() {
  if ($("#sheet").open) $("#sheet").close();
  $("#sheet").innerHTML = "";
  pending = null;
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
}
function settingsSheet() {
  showSheet(
    "Make it yours",
    `<p class="eyebrow" style="margin-top:22px">APPEARANCE</p><div class="segmented" role="group" aria-label="Appearance">${["light", "dark", "system"].map((t) => `<button class="${prefs.theme === t ? "selected" : ""}" data-action="theme" data-value="${t}" aria-pressed="${prefs.theme === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>${accentPicker()}<div class="settings-row"><div><strong>24-hour time</strong><p>Use 14:00 instead of 2:00 PM</p></div><button class="switch ${prefs.hour24 ? "on" : ""}" role="switch" aria-checked="${prefs.hour24}" aria-label="24-hour time" data-action="time-format"></button></div><div class="settings-row"><div><strong>Campus time zone</strong><p>Calgary · Mountain Time</p></div>${icon("pin")}</div><p class="notice">Campus Day works entirely offline. Your calendar is stored on this phone, with no account, tracking, or university password.</p><button class="secondary" data-action="help">${icon("info")}Calendar import help</button>${schedule ? '<button class="danger" data-action="remove-confirm">Remove imported timetable</button>' : ""}<p class="privacy-line">Campus Day 1.1 · Independently made for campus life</p>`,
  );
}
function detailSheet(id) {
  const e = schedule.events.find((e) => e.id === id);
  if (!e) return;
  showSheet(
    "Class details",
    `${codeLabel(e)}<div class="detail-title" style="color:${color(e.title)}">${esc(nameOf(e))}</div><p class="session-badge">${esc(typeLabel(e))}</p><div class="detail-item">${icon("book")}<div><strong>${esc(sessionInfo(e).instructor || "Instructor not added")}</strong><p>Instructor / teaching staff</p></div></div><div class="detail-item">${icon("calendar")}<div><strong>${esc(dateText(e.day, { weekday: "long", month: "long", day: "numeric" }))}</strong><p>${esc(dateText(e.day, { year: "numeric" }))}</p></div></div><div class="detail-item">${icon("clock")}<div><strong>${esc(timeRange(e))}</strong><p>${e.allDay ? "All-day event" : esc(duration(e.end - e.start)) + " · Calgary time"}</p></div></div><div class="detail-item">${icon("pin")}<div><strong>${esc(room(e.location))}</strong><p>${esc(e.location)}</p></div></div><button class="primary" style="margin-top:22px" data-action="view-day" data-value="${e.day}">View this day${icon("arrow")}</button><button class="secondary" style="margin-top:10px" data-action="subject" data-value="${esc(e.title)}">Subject details</button>`,
  );
}
function helpSheet() {
  showSheet(
    "Bring your schedule along",
    `<p class="sheet-subtitle">A fresh copy of your university calendar is all you need.</p><ol class="steps"><li>Log in to <strong>my.ucalgary.ca</strong> in your browser.</li><li>Open Student Centre and select your semester.</li><li>Tap <strong>Download Calendar</strong>. Save the <strong>.ics</strong> file to Downloads.</li><li>Come back here, tap <strong>Import timetable</strong>, and choose the file.</li></ol><p class="notice">You can also open or share a calendar file with Campus Day when your file app offers it. A new import replaces the old timetable, so classes won’t be duplicated.</p><button class="primary" data-action="import">${icon("upload")}Choose calendar file</button>`,
  );
}
function chooseFile() {
  closeSheet();
  if (window.Android) Android.importCalendar();
  else $("#file-input").click();
}
window.importFailed = (message) => {
  showSheet(
    "Let’s try that again",
    `<p class="sheet-subtitle">${esc(message)}</p><button class="primary" data-action="import">Choose another file</button>`,
  );
};
window.receiveCalendar = (text, filename) => {
  showSheet(
    "Reading your calendar",
    `<div class="loading">${icon("calendar")}<p>Putting your classes in order…</p></div>`,
  );
  setTimeout(() => {
    try {
      pending = E.parse(text, filename);
      showSheet(
        schedule ? "Update your timetable?" : "Your timetable is ready",
        `<p class="sheet-subtitle">${schedule ? "This will replace your current timetable. Your appearance settings stay the same." : "Your semester, neatly in place. Check the details below, then make it yours."}</p><div class="import-summary"><h3>${esc(pending.name)}</h3><p>${pending.courses.length} subjects · ${pending.events.length} class sessions</p><p>${esc(dateText(pending.first))} – ${esc(dateText(pending.last, { month: "long", day: "numeric", year: "numeric" }))}</p></div><div class="import-courses">${pending.courses
          .slice(0, 12)
          .map((c) => `<span>${icon("check")}${esc(c)}</span>`)
          .join(
            "",
          )}</div>${pending.bounded ? '<p class="notice">This calendar has no end date. The next two years of repeating events are included.</p>' : ""}<p class="privacy-line">${icon("shield")}Saved only on this phone · Calgary time</p><button class="primary" data-action="confirm-import">${schedule ? "Replace timetable" : "Let’s see my day"}${icon("arrow")}</button>`,
      );
    } catch (e) {
      pending = null;
      window.importFailed(
        e instanceof RangeError
          ? "A time zone in this calendar is not supported. Try a fresh UCalgary export."
          : e.message || "Could not read this calendar.",
      );
    }
  }, 40);
};
function confirmImport() {
  if (!pending) return;
  const value = pending;
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (e) {
    toast(
      "Could not save the timetable. Free up some device storage and try again.",
    );
    return;
  }
  schedule = value;
  selected = today();
  tab = "day";
  search = "";
  closeSheet();
  render();
  window.scrollTo(0, 0);
  toast("Timetable imported. You’re all set.");
  showImportSetup();
}
window.handleBack = () => {
  if ($("#sheet").open) {
    closeSheet();
    return true;
  }
  if (tab !== "day" || selected !== today()) {
    tab = "day";
    selected = today();
    render();
    window.scrollTo(0, 0);
    return true;
  }
  return false;
};
document.addEventListener("click", (event) => {
  const b = event.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action,
    v = b.dataset.value;
  haptic();
  if (a === "settings") settingsSheet();
  else if (a === "close") closeSheet();
  else if (a === "import") chooseFile();
  else if (a === "help") helpSheet();
  else if (a === "confirm-import") confirmImport();
  else if (a === "tab") {
    tab = v;
    render();
    window.scrollTo(0, 0);
  } else if (a === "date") {
    selected = v;
    render();
    window.scrollTo(0, 0);
  } else if (a === "today") {
    selected = today();
    render();
    window.scrollTo(0, 0);
  } else if (a === "shift-week") {
    selected = addDays(selected, +v);
    render();
    window.scrollTo(0, 0);
  } else if (a === "detail") detailSheet(v);
  else if (a === "subject") subjectSheet(v);
  else if (a === "edit-subject") editSubject(v);
  else if (a === "view-day") {
    selected = v;
    tab = "day";
    closeSheet();
    render();
    window.scrollTo(0, 0);
  } else if (a === "accent") {
    prefs.accent = v;
    savePrefs();
    render();
    settingsSheet();
  } else if (a === "theme") {
    prefs.theme = v;
    savePrefs();
    render();
    settingsSheet();
  } else if (a === "time-format") {
    prefs.hour24 = !prefs.hour24;
    savePrefs();
    render();
    settingsSheet();
  } else if (a === "remove-confirm")
    showSheet(
      "Remove your timetable?",
      `<p class="sheet-subtitle">This removes the imported classes from Campus Day. You can import the original calendar again at any time.</p><button class="primary" data-action="remove">Remove timetable</button><button class="text-button" data-action="close">Keep my timetable</button>`,
    );
  else if (a === "remove") {
    try {
      localStorage.removeItem(detailsKey);
      localStorage.removeItem(storageKey);
      courseDetails = {};
    } catch (e) {
      toast("Could not remove the saved timetable.");
      return;
    }
    schedule = null;
    closeSheet();
    render();
    toast("Timetable removed.");
  }
});
document.addEventListener("change", (event) => {
  if (
    event.target.id === "date-picker" &&
    /^\d{4}-\d{2}-\d{2}$/.test(event.target.value)
  ) {
    selected = event.target.value;
    render();
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "course-search") {
    search = event.target.value;
    $("#course-list").innerHTML = courseRows();
  }
});
$("#file-input").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 2097152) {
    window.importFailed("Choose an .ics calendar smaller than 2 MB.");
    return;
  }
  try {
    window.receiveCalendar(await file.text(), file.name);
  } catch (e) {
    window.importFailed("This file could not be opened. Choose another copy.");
  }
});
$("#sheet").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSheet();
});
$("#sheet").addEventListener("click", (event) => {
  if (event.target === $("#sheet")) {
    const r = $("#sheet").getBoundingClientRect();
    if (
      event.clientY < r.top ||
      event.clientX < r.left ||
      event.clientX > r.right
    )
      closeSheet();
  }
});
window.refreshClock = () => {
  const t = today();
  if (selected === lastToday && t !== lastToday) selected = t;
  lastToday = t;
  if (
    schedule &&
    tab === "day" &&
    !$("#sheet").open &&
    document.activeElement?.tagName !== "INPUT"
  ) {
    const focused = document.activeElement?.closest("[data-action]");
    const action = focused?.dataset.action,
      value = focused?.dataset.value;
    render();
    if (action) {
      const replacement = [...document.querySelectorAll("[data-action]")].find(
        (b) => b.dataset.action === action && b.dataset.value === value,
      );
      replacement?.focus({ preventScroll: true });
    }
  }
};
setInterval(window.refreshClock, 30000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) window.refreshClock();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (prefs.theme === "system") applyTheme();
});
render();
