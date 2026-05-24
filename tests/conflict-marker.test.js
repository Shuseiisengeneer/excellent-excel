const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const ignoredDirs = new Set([".git", "node_modules", "vendor"]);
const textExtensions = new Set([
  ".js",
  ".json",
  ".md",
  ".html",
  ".css",
  ".txt"
]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(path.join(dir, entry.name), files);
      continue;
    }
    if (textExtensions.has(path.extname(entry.name))) files.push(path.join(dir, entry.name));
  }
  return files;
}

test("project files do not contain merge conflict markers", () => {
  const matches = [];
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line, index) => {
      if (/^(<<<<<<<|=======|>>>>>>>)($| )/.test(line)) {
        matches.push(`${path.relative(root, file)}:${index + 1}:${line}`);
      }
    });
  }

  assert.deepEqual(matches, []);
});
