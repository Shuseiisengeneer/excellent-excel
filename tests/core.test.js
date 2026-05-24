const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/bubble-table-core");

test("normalizes object rows and explicit columns", () => {
  const data = [
    { Name: "Widget", Qty: 2 },
    { Name: "Service", Qty: 1 }
  ];
  const columns = [
    { title: "Item", field: "Name", width: 180 },
    { title: "Quantity", field: "Qty", hozAlign: "right" }
  ];

  const normalized = core.normalizeData(data, columns, true);

  assert.equal(normalized.rows.length, 2);
  assert.deepEqual(normalized.rows[0], { Name: "Widget", Qty: 2 });
  assert.equal(normalized.columns[0].title, "Item");
  assert.equal(normalized.columns[0].field, "Name");
  assert.equal(normalized.columns[0].editor, "input");
});

test("normalizes array rows into generated columns", () => {
  const normalized = core.normalizeData([
    ["A", 1],
    ["B", 2]
  ], null, false);

  assert.deepEqual(normalized.columns.map((column) => column.field), ["Column 1", "Column 2"]);
  assert.deepEqual(normalized.rows[1], { "Column 1": "B", "Column 2": 2 });
  assert.equal(normalized.columns[0].editor, undefined);
});

test("generates stable fields for column objects without field keys", () => {
  const normalized = core.normalizeData(
    [{ Product_Name: "Widget" }],
    [{ title: "Product Name" }],
    true
  );

  assert.equal(normalized.columns[0].field, "Product_Name");
});

test("parses JSON input and reports invalid JSON clearly", () => {
  assert.deepEqual(core.parseJsonInput("[1,2]", [], "data_json"), [1, 2]);
  assert.throws(
    () => core.parseJsonInput("{bad", [], "data_json"),
    /data_json is invalid/
  );
});

test("escapes spreadsheet formula prefixes for CSV export", () => {
  const rows = [
    { Name: "=cmd", Note: "+SUM(1,1)" },
    { Name: "-1", Note: "@mention" },
    { Name: "safe", Note: "plain" }
  ];
  const columns = [
    { title: "Name", field: "Name" },
    { title: "Note", field: "Note" }
  ];

  const csv = core.toCsv(rows, columns, true);

  assert.match(csv, /'=cmd/);
  assert.match(csv, /'\+SUM/);
  assert.match(csv, /'-1/);
  assert.match(csv, /'@mention/);
  assert.match(csv, /safe,plain/);
});

test("does not escape formulas when safe export is disabled", () => {
  const csv = core.toCsv(
    [{ Name: "=cmd" }],
    [{ title: "Name", field: "Name" }],
    false
  );

  assert.equal(csv, "Name\r\n=cmd");
});
