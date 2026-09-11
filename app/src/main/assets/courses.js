(function (root) {
  "use strict";
  const types = ["Lecture", "Tutorial", "Lab", "Seminar", "Class"];
  function identity(e) {
    const uid = (e.id || "").split("|")[0];
    const m = uid.match(
      /^(\d{7})(\d{4})(1?[BT]\d+|\d{3})-\d+@intrasee\.studentSelfService$/i,
    );
    if (m) {
      const series = m[3].toUpperCase().replace(/^1(?=[BT])/, "");
      return {
        key: `ucalgary:${m[1]}:${m[2]}`,
        courseId: m[1],
        term: m[2],
        section: series[0] === "1" ? series.slice(1) : series,
        series,
      };
    }
    return {
      key: `title:${e.title.trim().toLowerCase()}`,
      courseId: "",
      term: "",
      section: "",
      series: uid || e.title,
    };
  }
  function info(e, records = {}) {
    const id = identity(e),
      saved = Object.hasOwn(records, id.key) ? records[id.key] : {};
    const title = String(e.title || "Class");
    const match = title.match(
      /^([A-Z]{2,8})\s*(\d{2,4}[A-Z]?)\b\s*(?:[—–:-]\s*)?(.*)$/i,
    );
    return {
      ...id,
      code:
        saved.code ?? (match ? match[1].toUpperCase() + " " + match[2] : ""),
      name: saved.name || (match && match[3] ? match[3] : title),
      instructor: saved.instructor || "",
      office: saved.office || "",
      notes: saved.notes || "",
      sections: { ...saved.sections },
      source: "",
    };
  }
  function session(e, records = {}) {
    const c = info(e, records),
      custom = Object.hasOwn(c.sections, c.series) ? c.sections[c.series] : {};
    // B/T/numeric section designations in this UCalgary export represent
    // lab/tutorial/lecture. Unknown formats remain editable, untyped classes.
    const inferred = c.section
      ? c.section[0] === "B"
        ? "Lab"
        : c.section[0] === "T"
          ? "Tutorial"
          : "Lecture"
      : "Class";
    return {
      ...c,
      type: types.includes(custom.type) ? custom.type : inferred,
      instructor: custom.instructor || e.instructor || c.instructor || "",
    };
  }
  const api = { types, identity, info, session };
  if (typeof module !== "undefined") module.exports = api;
  else root.Courses = api;
})(typeof window !== "undefined" ? window : globalThis);
