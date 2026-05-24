const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

test("Node scripts have valid JavaScript syntax", () => {
  const scripts = fs.readdirSync(path.join(root, "scripts"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join(root, "scripts", name));

  assert.ok(scripts.length > 0);
  for (const script of scripts) {
    execFileSync(process.execPath, ["--check", script], { stdio: "pipe" });
  }
});
