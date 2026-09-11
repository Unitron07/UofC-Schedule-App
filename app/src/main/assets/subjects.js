"use strict";
function subjectGroups(title) {
  const groups = new Map();
  for (const event of schedule.events.filter((e) => e.title === title)) {
    const s = sessionInfo(event);
    if (!groups.has(s.series)) groups.set(s.series, { ...s, events: [] });
    groups.get(s.series).events.push(event);
  }
  return [...groups.values()].sort(
    (a, b) =>
      Courses.types.indexOf(a.type) - Courses.types.indexOf(b.type) ||
      a.section.localeCompare(b.section),
  );
}
function groupSchedule(group) {
  const patterns = new Map();
  for (const e of group.events) {
    const key = timeRange(e) + "|" + e.location;
    if (!patterns.has(key))
      patterns.set(key, {
        time: timeRange(e),
        location: e.location,
        days: new Set(),
      });
    patterns.get(key).days.add((dateObj(e.day).getUTCDay() + 6) % 7);
  }
  return [...patterns.values()]
    .map(
      (p) =>
        `<div class="meeting-pattern"><strong>${esc(
          [...p.days]
            .sort()
            .map((i) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i])
            .join(", "),
        )} · ${esc(p.time)}</strong><p>${esc(p.location)}</p></div>`,
    )
    .join("");
}
function subjectSheet(title) {
  const events = schedule.events.filter((e) => e.title === title);
  if (!events.length) return;
  const c = courseInfo(title),
    groups = subjectGroups(title),
    next = events.find((e) => e.end > Date.now());
  const staff =
    c.instructor ||
    [...new Set(events.map((e) => e.instructor).filter(Boolean))].join(", ");
  showSheet(
    "Subject details",
    `<div class="subject-heading" style="--course:${color(title)}">${c.code ? `<span class="course-code">${esc(c.code)}</span>` : ""}<h2>${esc(c.name)}</h2><p>${esc(dateText(events[0].day, { month: "short", day: "numeric" }))} – ${esc(dateText(events.at(-1).day, { month: "short", day: "numeric", year: "numeric" }))} · ${events.length} sessions</p></div><div class="detail-item">${icon("book")}<div><strong>${esc(staff || "Instructor not added")}</strong><p>${staff ? "Course instructor" : "Add the name from Student Centre or your course outline."}</p></div></div>${c.office ? `<div class="detail-item">${icon("clock")}<div><strong>Office / office hours</strong><p class="preserve-lines">${esc(c.office)}</p></div></div>` : ""}<button class="secondary" data-action="edit-subject" data-value="${esc(title)}">${icon("sliders")}Edit subject details</button><div class="section-head"><h2>Classes & rooms</h2><small>Calgary time</small></div>${groups.map((g) => `<section class="meeting-group" style="--course:${color(title)}"><div class="meeting-heading"><strong>${esc(g.type)}</strong>${g.section ? `<span>Section ${esc(g.section)}</span>` : ""}</div>${groupSchedule(g)}<p class="meeting-staff">${esc(g.instructor || "Teaching staff not added")}</p><p class="meeting-dates">${g.events.length} sessions · ${esc(dateText(g.events[0].day, { month: "short", day: "numeric" }))} – ${esc(dateText(g.events.at(-1).day, { month: "short", day: "numeric" }))}</p></section>`).join("")}${c.notes ? `<div class="section-head"><h2>Your notes</h2></div><p class="subject-notes preserve-lines">${esc(c.notes)}</p>` : ""}${next ? `<div class="section-head"><h2>Next session</h2></div><button class="secondary next-session" data-action="detail" data-value="${esc(next.id)}"><span>${esc(typeLabel(next))}<small>${esc(dateText(next.day, { weekday: "short", month: "short", day: "numeric" }))} · ${esc(time(next.start))}</small></span>${icon("arrow")}</button>` : ""}`,
  );
}
function editSubject(title, fromImport = false) {
  const c = courseInfo(title),
    groups = subjectGroups(title);
  showSheet(
    "Edit subject details",
    `<form id="subject-form" data-title="${esc(title)}" data-setup="${fromImport}"><p class="sheet-subtitle">Add the details you want at a glance. They stay saved when you re-import this semester.</p><label class="edit-field">Course code<input name="code" maxlength="30" value="${esc(c.code)}" placeholder="e.g. CS 101" autocomplete="off"></label><label class="edit-field">Full course name<input name="fullName" maxlength="250" value="${esc(c.name)}" required autocomplete="off"></label><label class="edit-field">Course instructor<input name="instructor" maxlength="160" value="${esc(c.instructor)}" placeholder="Name from Student Centre" autocomplete="off"></label><label class="edit-field">Office / office hours<textarea aria-label="Office / office hours" name="office" rows="2" maxlength="500" placeholder="Office location and drop-in times">${esc(c.office)}</textarea></label>${groups.length ? '<p class="eyebrow" style="margin:24px 0 12px">CLASS TYPES & TEACHING STAFF</p>' : ""}${groups.map((g, i) => `<fieldset class="edit-section"><legend>${esc(g.section ? "Section " + g.section : g.type)}</legend><p class="muted">${esc(room(g.events[0].location))}</p><label class="edit-field">Class type<select name="type-${i}">${Courses.types.map((t) => `<option value="${t}" ${t === g.type ? "selected" : ""}>${t}</option>`).join("")}</select></label><label class="edit-field">Instructor / TA for this section<input name="staff-${i}" maxlength="160" value="${esc(c.sections[g.series]?.instructor || "")}" placeholder="Use course instructor if blank" autocomplete="off"></label></fieldset>`).join("")}<label class="edit-field">Notes<textarea aria-label="Notes" name="notes" rows="3" maxlength="2000" placeholder="Anything useful for this subject">${esc(c.notes)}</textarea></label><button class="primary" type="submit">${icon("check")}${fromImport ? "Save and continue" : "Save details"}</button><button class="text-button" type="button" data-action="${fromImport ? "setup-back" : "subject"}" data-value="${esc(title)}">${fromImport ? "Back without saving" : "Cancel"}</button></form>`,
  );
}
document.addEventListener("submit", (event) => {
  if (event.target.id !== "subject-form") return;
  event.preventDefault();
  const form = event.target,
    title = form.dataset.title,
    c = courseInfo(title),
    groups = subjectGroups(title),
    data = new FormData(form);
  const name = String(data.get("fullName") || "").trim();
  if (!name) {
    form.elements.fullName.setCustomValidity("Enter a course name.");
    form.elements.fullName.reportValidity();
    return;
  }
  const sections = { ...c.sections };
  groups.forEach((g, i) => {
    sections[g.series] = {
      type: String(data.get(`type-${i}`)),
      instructor: String(data.get(`staff-${i}`) || "").trim(),
    };
  });
  const next = {
    ...courseDetails,
    [c.key]: {
      code: String(data.get("code") || "").trim(),
      name,
      instructor: String(data.get("instructor") || "").trim(),
      office: String(data.get("office") || "").trim(),
      notes: String(data.get("notes") || "").trim(),
      sections,
    },
  };
  try {
    localStorage.setItem(detailsKey, JSON.stringify(next));
  } catch (e) {
    toast(
      "Could not save details. Check your available storage and try again.",
    );
    return;
  }
  courseDetails = next;
  render();
  if (form.dataset.setup === "true") showImportSetup();
  else subjectSheet(title);
  toast("Subject details saved.");
});
document.addEventListener("input", (event) => {
  if (event.target.name === "fullName") event.target.setCustomValidity("");
});
function showImportSetup() {
  showSheet(
    "Add a few details?",
    `<p class="eyebrow">TIMETABLE IMPORTED · OPTIONAL STEP</p><p class="sheet-subtitle">Your classes are ready. Add instructor names, course information, or notes now—or skip and do it later from Timetable.</p>${academicStatus()}<div class="setup-subjects">${courseTitles()
      .map((title) => {
        const c = courseInfo(title);
        return `<button class="course-row" data-action="setup-edit" data-value="${esc(title)}" style="--course:${color(title)}"><span class="course-dot"></span><div class="subject-row-main">${c.code ? `<span class="course-code">${esc(c.code)}</span>` : ""}<h3>${esc(c.name)}</h3><p>${esc(c.instructor || "Add instructor and other details")}</p></div>${icon("right")}</button>`;
      })
      .join(
        "",
      )}</div><button class="primary" data-action="close" style="margin-top:22px">Done${icon("check")}</button><button class="text-button" data-action="close">Skip for now</button>`,
  );
}
document.addEventListener("click", (event) => {
  const b = event.target.closest("[data-action]");
  if (!b) return;
  if (b.dataset.action === "setup-edit") editSubject(b.dataset.value, true);
  else if (b.dataset.action === "setup-back") showImportSetup();
});
