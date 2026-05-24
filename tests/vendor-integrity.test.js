const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");

function sri(file) {
  return "sha384-" + crypto.createHash("sha384")
    .update(fs.readFileSync(path.join(root, file)))
    .digest("base64");
}

test("CDN header SRI hashes match vendored files", () => {
  const header = fs.readFileSync(path.join(root, "plugin/shared_header_cdn.html"), "utf8");

  assert.ok(header.includes(sri("vendor/tabulator.min.css")));
  assert.ok(header.includes(sri("vendor/tabulator.min.js")));
  assert.ok(header.includes(sri("vendor/xlsx.full.min.js")));
});
