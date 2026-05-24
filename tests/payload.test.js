const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("generated Bubble payload exists and references expected snippets", () => {
  const payloadPath = path.join(root, "dist/plugin-payload.json");
  const headerPath = path.join(root, "dist/shared_header_inline.html");

  assert.equal(fs.existsSync(payloadPath), true, "Run npm run build before npm test");
  assert.equal(fs.existsSync(headerPath), true, "Run npm run build before npm test");

  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  const header = fs.readFileSync(headerPath, "utf8");

  assert.equal(typeof payload.element_initialize_js, "string");
  assert.equal(typeof payload.element_update_js, "string");
  assert.equal(typeof payload.actions_js.add_row, "string");
  assert.match(header, /BubbleSpreadsheetTable/);
  assert.match(header, /tabulator-tables@6\.4\.0/);
  assert.match(header, /xlsx-0\.20\.3/);
});
