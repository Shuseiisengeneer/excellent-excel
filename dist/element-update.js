if (!window.BubbleSpreadsheetTable) {
  throw new Error("BubbleSpreadsheetTable is not loaded. Add src/bubble-table-core.js in the plugin Shared HTML Header or Shared assets.");
}

window.BubbleSpreadsheetTable.bubble.update(instance, properties, context);
