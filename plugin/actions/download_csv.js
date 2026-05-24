if (!window.BubbleSpreadsheetTable) {
  throw new Error("BubbleSpreadsheetTable is not loaded.");
}

window.BubbleSpreadsheetTable.bubble.actions.downloadCSV(instance, properties);
