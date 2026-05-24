const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    const workspaceFallback = path.resolve(__dirname, "../../bubble-fields/node_modules/playwright");
    if (fs.existsSync(workspaceFallback)) return require(workspaceFallback);
    throw error;
  }
}

test("Bubble element harness renders, publishes states, and exports data", async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  try {
    const url = pathToFileURL(path.resolve(__dirname, "../demo/index.html")).href;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".bst-root");

    const initial = await page.evaluate(() => ({
      rows: window.__bubbleTest.getRows(),
      states: window.__bubbleTest.states,
      events: window.__bubbleTest.events,
      hasTabulator: window.__bubbleTest.hasTabulator(),
      toolbarButtons: document.querySelectorAll(".bst-toolbar button").length,
      renderedRows: document.querySelectorAll(".tabulator-row").length,
      renderedCells: document.querySelectorAll(".tabulator-cell").length,
      styles: {
        fontFamily: getComputedStyle(document.querySelector(".bst-root")).fontFamily,
        toolbarBackground: getComputedStyle(document.querySelector(".bst-toolbar")).backgroundColor,
        toolbarButtonRadius: getComputedStyle(document.querySelector(".bst-toolbar button")).borderRadius,
        rootShadow: getComputedStyle(document.querySelector(".bst-root")).boxShadow,
        cellPaddingLeft: getComputedStyle(document.querySelector(".tabulator-cell")).paddingLeft,
        headerWeight: getComputedStyle(document.querySelector(".tabulator .tabulator-header .tabulator-col")).fontWeight
      },
      xss: window.__xss
    }));

    assert.equal(initial.rows.length, 3);
    assert.equal(initial.states.row_count, 3);
    assert.equal(initial.states.is_dirty, false);
    assert.ok(initial.events.includes("ready"));
    assert.equal(initial.toolbarButtons, 3);
    assert.ok(initial.renderedRows >= 3);
    assert.ok(initial.renderedCells >= 6);
    assert.match(initial.styles.fontFamily, /Inter/);
    assert.equal(initial.styles.toolbarBackground, "rgb(240, 249, 255)");
    assert.equal(initial.styles.toolbarButtonRadius, "8px");
    assert.equal(initial.styles.rootShadow, "none");
    assert.equal(initial.styles.cellPaddingLeft, "12px");
    assert.equal(initial.styles.headerWeight, "700");
    assert.equal(initial.xss, false);

    page.once("dialog", (dialog) => dialog.accept("Extra Note"));
    await page.click(".bst-add-column");
    await page.waitForFunction(() => {
      return JSON.parse(window.__bubbleTest.states.data_json)[0].Extra_Note === "";
    });

    await page.click(".bst-add-row");
    await page.waitForFunction(() => JSON.parse(window.__bubbleTest.states.data_json).length === 4);

    await page.evaluate(() => {
      window.__bubbleTest.instance.data.bst.addRow(JSON.stringify({
        Name: "Added",
        Qty: 3,
        Note: "@unsafe"
      }));
    });

    await page.waitForFunction(() => JSON.parse(window.__bubbleTest.states.data_json).length === 5);

    const afterAdd = await page.evaluate(() => ({
      rows: window.__bubbleTest.getRows(),
      states: window.__bubbleTest.states,
      csv: window.__bubbleTest.getCsv(),
      sheetNames: window.__bubbleTest.buildWorkbookSheetNames()
    }));

    assert.equal(afterAdd.rows.length, 5);
    assert.equal(afterAdd.states.row_count, 5);
    assert.equal(afterAdd.states.is_dirty, true);
    assert.equal(afterAdd.rows[0].Extra_Note, "");
    assert.match(afterAdd.csv, /Extra Note/);
    assert.match(afterAdd.csv, /'@unsafe/);
    assert.deepEqual(afterAdd.sheetNames, ["Demo"]);

    const usesRealTabulator = await page.evaluate(() => !!window.Tabulator);
    assert.equal(usesRealTabulator, true);
    assert.equal(afterAdd.rows[1].Name, "<img src=x onerror='window.__xss=true'>");
  } finally {
    await browser.close();
  }

  assert.deepEqual(pageErrors, []);
});

test("Bubble pasted snippets initialize, update, and run element actions", async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  const readSnippet = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

  try {
    await page.setContent("<!doctype html><html><head></head><body><div id=\"bubble-canvas\" style=\"height:420px\"></div></body></html>");
    await page.addStyleTag({ path: path.join(root, "vendor/tabulator.min.css") });
    await page.addScriptTag({ path: path.join(root, "vendor/tabulator.min.js") });
    await page.addScriptTag({ path: path.join(root, "vendor/xlsx.full.min.js") });
    await page.addScriptTag({ path: path.join(root, "src/bubble-table-core.js") });

    await page.evaluate(({ initializeCode, updateCode, actionCode }) => {
      window.__snippetStates = {};
      window.__snippetEvents = [];
      window.__snippetInstance = {
        data: {},
        canvas: {
          0: document.getElementById("bubble-canvas"),
          append(node) {
            document.getElementById("bubble-canvas").appendChild(node);
          },
          get() {
            return document.getElementById("bubble-canvas");
          }
        },
        publishState(key, value) {
          window.__snippetStates[key] = value;
        },
        triggerEvent(key) {
          window.__snippetEvents.push(key);
        }
      };
      window.__snippetProperties = {
        data_json: JSON.stringify([
          { Name: "Widget", Qty: 2 },
          { Name: "Service", Qty: 1 }
        ]),
        columns_json: JSON.stringify([
          { title: "Name", field: "Name", width: 180 },
          { title: "Qty", field: "Qty", hozAlign: "right", width: 90 }
        ]),
        table_height: "420px",
        layout: "fitColumns",
        editable: true,
        pagination: false,
        page_size: 25,
        selectable_rows: true,
        movable_columns: true,
        resizable_columns: true,
        placeholder: "No data",
        safe_export: true,
        sheet_name: "Snippet",
        csv_file_name: "snippet.csv",
        xlsx_file_name: "snippet.xlsx",
        header_background_color: "#f8fafc",
        header_text_color: "#0f172a",
        row_background_color: "#ffffff",
        alternate_row_background_color: "#f8fafc",
        text_color: "#111827",
        border_color: "#d1d5db",
        accent_color: "#2563eb",
        font_size: 14,
        row_height: 36
      };

      Function("instance", "properties", "context", initializeCode)(
        window.__snippetInstance,
        window.__snippetProperties,
        {}
      );
      Function("instance", "properties", "context", updateCode)(
        window.__snippetInstance,
        window.__snippetProperties,
        {}
      );

      Function("instance", "properties", "context", actionCode.addRow)(
        window.__snippetInstance,
        { row_json: JSON.stringify({ Name: "Added", Qty: 3 }) },
        {}
      );
      Function("instance", "properties", "context", actionCode.clearDirty)(
        window.__snippetInstance,
        {},
        {}
      );
      Function("instance", "properties", "context", actionCode.setData)(
        window.__snippetInstance,
        {
          data_json: JSON.stringify([{ Name: "Reset", Qty: 9 }]),
          columns_json: window.__snippetProperties.columns_json
        },
        {}
      );
      Function("instance", "properties", "context", actionCode.refresh)(
        window.__snippetInstance,
        {},
        {}
      );
    }, {
      initializeCode: readSnippet("plugin/element-initialize.js"),
      updateCode: readSnippet("plugin/element-update.js"),
      actionCode: {
        addRow: readSnippet("plugin/actions/add_row.js"),
        clearDirty: readSnippet("plugin/actions/clear_dirty.js"),
        setData: readSnippet("plugin/actions/set_data.js"),
        refresh: readSnippet("plugin/actions/refresh.js")
      }
    });

    await page.waitForFunction(() => JSON.parse(window.__snippetStates.data_json).length === 1);

    const result = await page.evaluate(() => ({
      rows: window.__snippetInstance.data.bst.getData(),
      states: window.__snippetStates,
      events: window.__snippetEvents,
      hasTable: !!document.querySelector(".bst-root")
    }));

    assert.equal(result.hasTable, true);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].Name, "Reset");
    assert.equal(result.states.row_count, 1);
    assert.equal(result.states.is_dirty, true);
    assert.ok(result.events.includes("ready"));
    assert.ok(result.events.includes("data_changed"));
  } finally {
    await browser.close();
  }

  assert.deepEqual(pageErrors, []);
});
