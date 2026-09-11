module.exports = function fixture({
  year = 2026,
  holidayDay = 30,
  draftDay = 29,
} = {}) {
  function table(day) {
    return (
      "<table><tr><td></td><td>Fall Term " +
      year +
      "</td><td>Winter Term " +
      (year + 1) +
      "</td></tr>" +
      "<tr><td>Term Break, no classes</td><td>Sunday-Saturday, November 8-14</td><td>Sunday-Saturday, February 14-20</td></tr>" +
      '<tr><th colspan="3">Recognized Holidays (university closed)</th></tr>' +
      "<tr><td>National Day for Truth and Reconciliation, University closed</td><td>Wednesday, September " +
      day +
      "</td><td></td></tr>" +
      "<tr><td>Remembrance Day</td><td>Wednesday, November 11</td><td></td></tr>" +
      "<tr><td>Holiday Observance</td><td>Friday-Thursday, December 25-31</td><td></td></tr>" +
      "<tr><td>New Year&#39;s Day</td><td></td><td>Friday, January 1</td></tr></table>"
    );
  }
  const data = [];
  function pack(value) {
    const index = data.length;
    data.push(null);
    data[index] = Array.isArray(value)
      ? value.map(pack)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, pack(v)]),
          )
        : value;
    return index;
  }
  pack({
    "custom-page-acadsched": {
      published: true,
      widgets: [{ type: "tabs", data: [{ content: table(holidayDay) }] }],
      temporaryWidgets: [
        { type: "tabs", data: [{ content: table(draftDay) }] },
      ],
    },
  });
  return (
    '<html><script id="__NUXT_DATA__" type="application/json">' +
    JSON.stringify(data) +
    "</script></html>"
  );
};
