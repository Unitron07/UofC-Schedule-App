(function (root) {
  "use strict";
  const SOURCE = "https://calendar.ucalgary.ca/acadsched";
  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  function text(html) {
    return String(html)
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&(?:apos|#39);/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, " ")
      .trim();
  }
  function date(year, month, day) {
    const d = new Date(Date.UTC(year, month, day));
    if (
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() !== month ||
      d.getUTCDate() !== day
    )
      throw new Error("Invalid academic date");
    return d.toISOString().slice(0, 10);
  }
  function range(value, year) {
    const match = value.match(
      new RegExp(
        "(" +
          MONTHS.join("|") +
          ")\\s+(\\d{1,2})(?:\\s*[-–—]\\s*(?:(" +
          MONTHS.join("|") +
          ")\\s+)?(\\d{1,2}))?",
        "i",
      ),
    );
    if (!match) throw new Error("Academic date format changed");
    const month = MONTHS.findIndex(
      (m) => m.toLowerCase() === match[1].toLowerCase(),
    );
    const endMonth = match[3]
      ? MONTHS.findIndex((m) => m.toLowerCase() === match[3].toLowerCase())
      : month;
    const start = date(year, month, +match[2]),
      end = date(
        year + (endMonth < month ? 1 : 0),
        endMonth,
        +(match[4] || match[2]),
      );
    if (end < start || (Date.parse(end) - Date.parse(start)) / 86400000 > 31)
      throw new Error("Unexpected academic date range");
    return { start, end };
  }
  function publishedTabs(html) {
    if (typeof html !== "string" || html.length > 2097152)
      throw new Error("Academic page too large");
    const script = html.match(
      /<script\b[^>]*\bid=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!script) throw new Error("Academic page format changed");
    const data = JSON.parse(script[1]);
    if (!Array.isArray(data)) throw new Error("Invalid academic page");
    const entry = data.find(
      (v) =>
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        Object.hasOwn(v, "custom-page-acadsched"),
    );
    const page = entry && data[entry["custom-page-acadsched"]];
    if (!page || data[page.published] !== true)
      throw new Error("Published schedule unavailable");
    // Read only published widgets; temporaryWidgets can contain unpublished drafts.
    const widgets = data[page.widgets],
      tabs = [];
    if (!Array.isArray(widgets)) throw new Error("Academic tabs unavailable");
    for (const ref of widgets) {
      const widget = data[ref];
      if (data[widget?.type] !== "tabs") continue;
      for (const tabRef of data[widget.data] || []) {
        const tab = data[tabRef],
          content = data[tab?.content];
        if (typeof content === "string") tabs.push(content);
      }
    }
    return tabs;
  }
  function parsePage(html, checkedAt = Date.now()) {
    const periods = [],
      years = new Set();
    for (const tab of publishedTabs(html)) {
      for (const table of tab.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
        const rows = [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
        if (!rows.length) continue;
        const cells = (row) =>
          [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
            text(m[1]),
          );
        const headers = cells(rows[0][1]);
        const terms = headers.map((h) => {
          const m = h.match(
            /(Fall|Winter|Spring|Summer)[\s\S]*?\b(20\d{2})\b/i,
          );
          return m ? { name: m[1], year: +m[2] } : null;
        });
        if (!terms.some(Boolean)) continue;
        let holidays = false,
          count = 0;
        for (const row of rows.slice(1)) {
          const values = cells(row[1]),
            label = values[0] || "";
          if (/Recognized Holidays/i.test(label)) {
            holidays = true;
            continue;
          }
          const isBreak = /^Term Break,\s*no classes$/i.test(label);
          if (!holidays && !isBreak) continue;
          if (values.length !== headers.length)
            throw new Error("Academic table columns changed");
          const name = label.replace(/,\s*University closed\.?$/i, "").trim();
          if (!name || name.length > 120)
            throw new Error("Invalid academic label");
          for (let i = 1; i < values.length; i++) {
            if (!values[i]) continue;
            if (!terms[i]) throw new Error("Missing academic year");
            const dates = range(values[i], terms[i].year);
            periods.push({
              ...dates,
              name: isBreak ? terms[i].name + " term break" : name,
              kind: isBreak ? "break" : "holiday",
            });
            count++;
          }
        }
        if (!holidays || count === 0)
          throw new Error("Holiday table unavailable");
        for (const term of terms.filter(Boolean)) years.add(term.year);
      }
    }
    if (!periods.length || periods.length > 150)
      throw new Error("Academic dates unavailable");
    const unique = [
      ...new Map(periods.map((p) => [JSON.stringify(p), p])).values(),
    ].sort(
      (a, b) => a.start.localeCompare(b.start) || a.kind.localeCompare(b.kind),
    );
    return {
      version: 1,
      source: SOURCE,
      checkedAt,
      years: [...years].sort(),
      periods: unique,
    };
  }
  function valid(data) {
    return (
      data?.version === 1 &&
      data.source === SOURCE &&
      Number.isFinite(data.checkedAt) &&
      Array.isArray(data.years) &&
      data.years.length <= 20 &&
      data.years.every((y) => Number.isInteger(y) && y >= 2000 && y <= 2199) &&
      Array.isArray(data.periods) &&
      data.periods.length <= 300 &&
      data.periods.every(
        (p) =>
          typeof p.name === "string" &&
          p.name.length <= 120 &&
          /^\d{4}-\d{2}-\d{2}$/.test(p.start) &&
          /^\d{4}-\d{2}-\d{2}$/.test(p.end) &&
          p.start <= p.end &&
          ["holiday", "break"].includes(p.kind),
      )
    );
  }
  function merge(previous, next) {
    if (!valid(next)) throw new Error("Invalid academic data");
    if (!valid(previous)) return next;
    return {
      ...next,
      periods: [
        ...previous.periods.filter(
          (p) => !next.years.includes(+p.start.slice(0, 4)),
        ),
        ...next.periods,
      ],
      years: [...new Set([...previous.years, ...next.years])].sort(),
    };
  }
  function forDay(data, day) {
    const matches = data.periods
      .filter((p) => p.start <= day && p.end >= day)
      .sort(
        (a, b) =>
          (a.kind === "holiday" ? 0 : 1) - (b.kind === "holiday" ? 0 : 1),
      );
    if (!matches.length) return null;
    return {
      title: matches[0].name,
      detail: [
        matches[0].kind === "holiday"
          ? "University closed"
          : "No classes scheduled by the university",
        ...matches.slice(1).map((p) => p.name),
      ].join(" · "),
    };
  }
  const api = { SOURCE, parsePage, valid, merge, forDay };
  if (typeof module !== "undefined") module.exports = api;
  else root.AcademicCalendar = api;
})(typeof window !== "undefined" ? window : globalThis);
