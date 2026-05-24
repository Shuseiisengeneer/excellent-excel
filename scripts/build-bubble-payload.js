const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function write(relativePath, value) {
  fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
  fs.writeFileSync(path.join(root, relativePath), value);
}

function sri(relativePath) {
  return "sha384-" + crypto.createHash("sha384")
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest("base64");
}

const core = read("src/bubble-table-core.js");
const init = read("plugin/element-initialize.js");
const update = read("plugin/element-update.js");
const actions = Object.fromEntries(
  fs.readdirSync(path.join(root, "plugin/actions"))
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => [name.replace(/\.js$/, ""), read(`plugin/actions/${name}`)])
);

const headerInline = [
  "<!-- Tabulator table UI. Version pinned. -->",
  `<link href="https://unpkg.com/tabulator-tables@6.4.0/dist/css/tabulator.min.css" rel="stylesheet" integrity="${sri("vendor/tabulator.min.css")}" crossorigin="anonymous">`,
  `<script src="https://unpkg.com/tabulator-tables@6.4.0/dist/js/tabulator.min.js" integrity="${sri("vendor/tabulator.min.js")}" crossorigin="anonymous"></script>`,
  "",
  "<!-- SheetJS export support. Version pinned. -->",
  `<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js" integrity="${sri("vendor/xlsx.full.min.js")}" crossorigin="anonymous"></script>`,
  "",
  "<!-- Bubble Spreadsheet Table core. Inline mode avoids a separate Shared asset URL. -->",
  "<script>",
  core,
  "</script>",
  ""
].join("\n");

const payload = {
  generated_at: new Date().toISOString(),
  version: JSON.parse(read("package.json")).version,
  shared_header_inline_html: "dist/shared_header_inline.html",
  shared_header_cdn_html: "plugin/shared_header_cdn.html",
  shared_header_local_assets_html: "plugin/shared_header_local_assets.html",
  element_initialize_js: init,
  element_update_js: update,
  actions_js: actions,
  vendor_sri: {
    "tabulator.min.css": sri("vendor/tabulator.min.css"),
    "tabulator.min.js": sri("vendor/tabulator.min.js"),
    "xlsx.full.min.js": sri("vendor/xlsx.full.min.js")
  }
};

write("dist/shared_header_inline.html", headerInline);
write("dist/plugin-payload.json", JSON.stringify(payload, null, 2) + "\n");
write("dist/element-initialize.js", init);
write("dist/element-update.js", update);
for (const [name, code] of Object.entries(actions)) {
  write(`dist/actions/${name}.js`, code);
}

console.log(`Wrote ${path.relative(process.cwd(), path.join(dist, "shared_header_inline.html"))}`);
console.log(`Wrote ${path.relative(process.cwd(), path.join(dist, "plugin-payload.json"))}`);
