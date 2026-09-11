(function (root) {
  "use strict";
  const key = "campusday.academic-dates.v1",
    A = root.AcademicCalendar;
  let data = root.BUNDLED_ACADEMIC_DATES,
    stored = false,
    status = "idle",
    pending = null;
  try {
    const cached = JSON.parse(localStorage.getItem(key));
    if (A.valid(cached) && cached.checkedAt >= data.checkedAt) {
      data = cached;
      stored = true;
    }
  } catch (e) {}
  function summary() {
    const checked = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Edmonton",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(data.checkedAt));
    if (status === "loading")
      return "Checking UCalgary holiday and break dates…";
    if (status === "failed")
      return "Couldn’t refresh. Using saved dates checked " + checked + ".";
    if (status === "unsaved")
      return "Dates refreshed for this session; storage is full.";
    return (
      (stored ? "Last checked " : "Included dates checked ") + checked + "."
    );
  }
  function notify() {
    document.querySelectorAll("[data-academic-status]").forEach((el) => {
      el.textContent = summary();
    });
    if (root.onAcademicDatesChanged) root.onAcademicDatesChanged();
  }
  function refresh() {
    if (pending) return pending;
    status = "loading";
    notify();
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    pending = (async () => {
      try {
        const response = await fetch("/academic-calendar", {
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit",
        });
        if (!response.ok) throw new Error("Academic page unavailable");
        const next = A.parsePage(await response.text());
        data = A.merge(data, next);
        try {
          localStorage.setItem(key, JSON.stringify(data));
          stored = true;
          status = "ready";
        } catch (e) {
          status = "unsaved";
        }
      } catch (e) {
        status = "failed";
      } finally {
        clearTimeout(timer);
        pending = null;
        notify();
      }
    })();
    return pending;
  }
  root.AcademicDates = {
    forDay: (day) => A.forDay(data, day),
    summary,
    refresh,
  };
})(window);
