const test = require("node:test"),
  assert = require("node:assert/strict");
const C = require("../app/src/main/assets/courses.js");
const e = (section) => ({
  id: "999000122771" + section + "-1@intrasee.studentSelfService",
  title: "CS 101 — Foundations of Computing",
});
test("Generic titles supply codes and names, never teaching staff", () => {
  const c = C.session(e("01"));
  assert.equal(c.code, "CS 101");
  assert.equal(c.name, "Foundations of Computing");
  assert.equal(c.instructor, "");
  assert.equal(c.type, "Lecture");
});
test("Portal section formats distinguish labs and tutorials", () => {
  assert.equal(C.session(e("B01")).type, "Lab");
  assert.equal(C.session(e("T01")).type, "Tutorial");
  assert.equal(C.identity(e("B01")).key, C.identity(e("01")).key);
});
test("Manual details and section overrides survive occurrence changes", () => {
  const key = C.identity(e("01")).key;
  const records = {
    [key]: {
      name: "Custom name",
      instructor: "Example instructor",
      sections: { B01: { instructor: "Example TA", type: "Seminar" } },
    },
  };
  assert.equal(C.session(e("B01"), records).instructor, "Example TA");
  assert.equal(C.session(e("B01"), records).type, "Seminar");
  assert.equal(C.session(e("01"), records).name, "Custom name");
});
test("Unknown course titles remain usable and untyped", () => {
  const c = C.session({ title: "Studio practice", id: "fictional" });
  assert.equal(c.code, "");
  assert.equal(c.name, "Studio practice");
  assert.equal(c.type, "Class");
});
