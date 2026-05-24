#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    const workspaceFallback = path.resolve(__dirname, "../../bubble-fields/node_modules/playwright");
    if (fs.existsSync(workspaceFallback)) return require(workspaceFallback);
    throw error;
  }
}

function parseArgs(argv) {
  const args = {
    url: process.env.BUBBLE_PREVIEW_URL || "",
    headed: process.env.HEADED === "1",
    evidenceDir: process.env.EVIDENCE_DIR || "evidence",
    userDataDir: process.env.USER_DATA_DIR || "",
    timeoutMs: Number(process.env.TIMEOUT_MS || 45000)
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--headed") args.headed = true;
    else if (arg === "--url") args.url = argv[++index] || "";
    else if (arg === "--evidence-dir") args.evidenceDir = argv[++index] || args.evidenceDir;
    else if (arg === "--user-data-dir") args.userDataDir = argv[++index] || "";
    else if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++index] || args.timeoutMs);
    else if (!arg.startsWith("--") && !args.url) args.url = arg;
  }

  return args;
}

function usage() {
  console.error([
    "Usage:",
    "  BUBBLE_PREVIEW_URL=https://your-app.bubbleapps.io/version-test/page npm run verify:bubble",
    "  npm run verify:bubble -- --url https://your-app.bubbleapps.io/version-test/page --headed",
    "",
    "Optional:",
    "  --user-data-dir /path/to/chrome-profile  Reuse login/session cookies when Bubble preview needs auth.",
    "  --evidence-dir evidence               Where JSON and screenshots are written.",
    "  --timeout-ms 45000                   Max wait for the table to appear."
  ].join("\n"));
}

async function createBrowser(args) {
  const { chromium } = loadPlaywright();
  if (args.userDataDir) {
    const context = await chromium.launchPersistentContext(path.resolve(args.userDataDir), {
      headless: !args.headed,
      viewport: { width: 1366, height: 900 }
    });
    return { browser: null, context };
  }

  const browser = await chromium.launch({ headless: !args.headed });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  return { browser, context };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    usage();
    process.exit(2);
  }

  const evidenceRoot = path.resolve(args.evidenceDir);
  fs.mkdirSync(evidenceRoot, { recursive: true });

  const pageErrors = [];
  const consoleErrors = [];
  const { browser, context } = await createBrowser(args);
  const page = await context.newPage();

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const startedAt = new Date().toISOString();
  let result;

  try {
    await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: args.timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: args.timeoutMs }).catch(() => {});

    await page.waitForFunction(() => {
      return !!document.querySelector(".bst-root, .tabulator, .bst-fallback-table");
    }, { timeout: args.timeoutMs });

    await page.waitForTimeout(750);

    const beforeEdit = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      hasCore: !!window.BubbleSpreadsheetTable,
      hasTabulatorGlobal: !!window.Tabulator,
      hasRoot: !!document.querySelector(".bst-root"),
      hasTabulatorDom: !!document.querySelector(".tabulator"),
      hasFallbackDom: !!document.querySelector(".bst-fallback-table"),
      renderedRows: document.querySelectorAll(".tabulator-row, .bst-fallback-table tbody tr").length,
      renderedCells: document.querySelectorAll(".tabulator-cell, .bst-fallback-table td").length,
      visibleText: (document.querySelector(".bst-root") || document.body).innerText.slice(0, 1200)
    }));

    const firstCell = page.locator(".tabulator-cell, .bst-fallback-table td").first();
    const cellCount = await firstCell.count();
    let editResult = { attempted: false, changed: false, before: "", after: "" };

    if (cellCount > 0) {
      editResult.attempted = true;
      editResult.before = await firstCell.innerText().catch(() => "");
      await firstCell.dblclick({ timeout: 5000 }).catch(() => {});
      await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
      await page.keyboard.type("Bubble Verify Edit").catch(() => {});
      await page.keyboard.press("Enter").catch(() => {});
      await page.waitForTimeout(500);
      editResult.after = await firstCell.innerText().catch(() => "");
      editResult.changed = editResult.after.includes("Bubble Verify Edit");
    }

    result = {
      status: "passed",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      requested_url: args.url,
      final_url: page.url(),
      before_edit: beforeEdit,
      edit_result: editResult,
      page_errors: pageErrors,
      console_errors: consoleErrors,
      assertions: {
        core_loaded: beforeEdit.hasCore,
        table_root_present: beforeEdit.hasRoot,
        table_dom_present: beforeEdit.hasTabulatorDom || beforeEdit.hasFallbackDom,
        rows_rendered: beforeEdit.renderedRows > 0,
        cells_rendered: beforeEdit.renderedCells > 0,
        no_page_errors: pageErrors.length === 0,
        no_console_errors: consoleErrors.length === 0
      }
    };

    const failedAssertions = Object.entries(result.assertions)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    if (failedAssertions.length) {
      result.status = "failed";
      result.failed_assertions = failedAssertions;
    }
  } catch (error) {
    result = {
      status: "failed",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      requested_url: args.url,
      final_url: page.url(),
      error: error.message,
      page_errors: pageErrors,
      console_errors: consoleErrors
    };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(evidenceRoot, `bubble-runtime-${timestamp}.json`);
  const screenshotPath = path.join(evidenceRoot, `bubble-runtime-${timestamp}.png`);

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n");
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

  await context.close();
  if (browser) await browser.close();

  console.log(`Evidence JSON: ${jsonPath}`);
  console.log(`Screenshot: ${screenshotPath}`);
  console.log(`Status: ${result.status}`);

  if (result.status !== "passed") process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
