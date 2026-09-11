const fs = require("node:fs"),
  https = require("node:https"),
  path = require("node:path");
const A = require("../app/src/main/assets/academic.js");
// Keep fetched page content and editor metadata out of the repository.
const request = https.get(
  A.SOURCE,
  { headers: { "User-Agent": "CampusDay-snapshot/1.2", Accept: "text/html" } },
  (response) => {
    if (response.statusCode !== 200) {
      response.resume();
      console.error("Academic calendar returned HTTP " + response.statusCode);
      process.exitCode = 1;
      return;
    }
    const chunks = [];
    let size = 0;
    response.on("data", (chunk) => {
      size += chunk.length;
      if (size > 2097152) request.destroy(new Error("Academic page too large"));
      else chunks.push(chunk);
    });
    response.on("end", () => {
      if (request.destroyed && size > 2097152) return;
      try {
        const data = A.parsePage(Buffer.concat(chunks).toString("utf8"));
        const target = path.join(
          __dirname,
          "../app/src/main/assets/academic-data.js",
        );
        fs.writeFileSync(
          target,
          "// Public UCalgary dates; no student data.\nwindow.BUNDLED_ACADEMIC_DATES = " +
            JSON.stringify(data, null, 2) +
            ";\n",
        );
        console.log(
          "Updated " +
            data.periods.length +
            " public holiday/break ranges. Run npm run format before committing.",
        );
      } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
      }
    });
  },
);
request.setTimeout(15000, () =>
  request.destroy(new Error("Academic request timed out")),
);
request.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
