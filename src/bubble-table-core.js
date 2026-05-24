(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(root);
  } else {
    root.BubbleSpreadsheetTable = factory(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  var VERSION = "0.1.0";
  var instanceSeq = 0;
  var dangerousFormulaPrefix = /^[=+\-@\t\r\n]/;

  var defaults = {
    height: "360px",
    layout: "fitColumns",
    editable: true,
    pagination: false,
    pageSize: 25,
    selectableRows: true,
    movableColumns: true,
    resizableColumns: true,
    placeholder: "No data",
    safeExport: true,
    sheetName: "Sheet1",
    csvFileName: "table.csv",
    xlsxFileName: "table.xlsx",
    style: {
      headerBackground: "#f8fafc",
      headerText: "#0f172a",
      rowBackground: "#ffffff",
      alternateRowBackground: "#f8fafc",
      text: "#111827",
      border: "#d1d5db",
      accent: "#2563eb",
      fontSize: 14,
      rowHeight: 36
    }
  };

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function isEmpty(value) {
    return value == null || value === "";
  }

  function asBoolean(value, fallback) {
    if (value == null || value === "") return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      var normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "yes" || normalized === "1") return true;
      if (normalized === "false" || normalized === "no" || normalized === "0") return false;
    }
    return fallback;
  }

  function asNumber(value, fallback) {
    if (value == null || value === "") return fallback;
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function asSize(value, fallback) {
    if (value == null || value === "") return fallback;
    if (typeof value === "number") return value + "px";
    var text = String(value).trim();
    if (/^\d+$/.test(text)) return text + "px";
    return text;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function parseJsonInput(value, fallback, label) {
    if (isEmpty(value)) return fallback;
    if (Array.isArray(value) || isPlainObject(value)) return value;
    if (typeof value !== "string") {
      throw new Error((label || "JSON") + " must be a JSON string, array, or object");
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error((label || "JSON") + " is invalid: " + error.message);
    }
  }

  function safeFieldName(input, index, used) {
    var base = String(input == null || input === "" ? "Column " + (index + 1) : input)
      .trim()
      .replace(/[^A-Za-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!base) base = "column_" + (index + 1);
    if (/^[0-9]/.test(base)) base = "column_" + base;

    var field = base;
    var suffix = 2;
    while (used[field]) {
      field = base + "_" + suffix;
      suffix += 1;
    }
    used[field] = true;
    return field;
  }

  function normalizeCell(value) {
    if (value == null) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") return JSON.stringify(value);
    return value;
  }

  function normalizeColumnObject(raw, index, used, editable) {
    var column = {};
    if (typeof raw === "string") {
      column.title = raw;
      column.field = raw || safeFieldName(raw, index, used);
      if (used[column.field]) column.field = safeFieldName(column.field, index, used);
      used[column.field] = true;
    } else if (isPlainObject(raw)) {
      column.title = String(raw.title || raw.name || raw.label || raw.field || raw.id || "Column " + (index + 1));
      if (raw.field || raw.id) {
        column.field = String(raw.field || raw.id);
        if (used[column.field]) column.field = safeFieldName(column.field, index, used);
        used[column.field] = true;
      } else {
        column.field = safeFieldName(column.title, index, used);
      }

      copyAllowedColumnProps(raw, column);
    } else {
      column.title = "Column " + (index + 1);
      column.field = safeFieldName(column.title, index, used);
    }

    if (editable && column.editor == null) column.editor = "input";
    if (!editable) delete column.editor;
    return column;
  }

  function copyAllowedColumnProps(raw, target) {
    var allowed = [
      "width",
      "minWidth",
      "maxWidth",
      "hozAlign",
      "headerHozAlign",
      "vertAlign",
      "sorter",
      "formatter",
      "editor",
      "visible",
      "frozen",
      "headerSort",
      "validator"
    ];
    for (var i = 0; i < allowed.length; i += 1) {
      var key = allowed[i];
      if (raw[key] != null) target[key] = raw[key];
    }
  }

  function inferColumnsFromRows(rows, editable) {
    var used = {};
    var keys = [];
    rows.forEach(function (row) {
      Object.keys(row).forEach(function (key) {
        if (keys.indexOf(key) === -1) keys.push(key);
      });
    });
    if (!keys.length) keys = ["Column 1"];
    return keys.map(function (key, index) {
      used[key] = true;
      var column = { title: key, field: key };
      if (editable) column.editor = "input";
      return column;
    });
  }

  function normalizeColumns(rawColumns, rows, editable) {
    if (!Array.isArray(rawColumns) || !rawColumns.length) {
      return inferColumnsFromRows(rows, editable);
    }
    var used = {};
    return rawColumns.map(function (raw, index) {
      return normalizeColumnObject(raw, index, used, editable);
    });
  }

  function rowsFromArrayRows(arrayRows, columns) {
    var fields = columns.map(function (column) { return column.field; });
    return arrayRows.map(function (row) {
      var item = {};
      for (var i = 0; i < fields.length; i += 1) {
        item[fields[i]] = normalizeCell(row[i]);
      }
      return item;
    });
  }

  function rowsFromObjectRows(objectRows) {
    return objectRows.map(function (row) {
      var item = {};
      Object.keys(row || {}).forEach(function (key) {
        item[key] = normalizeCell(row[key]);
      });
      return item;
    });
  }

  function normalizeData(dataInput, columnsInput, editable) {
    var rawData = dataInput;
    var rawColumns = columnsInput;

    if (isPlainObject(rawData)) {
      if (rawData.columns && !rawColumns) rawColumns = rawData.columns;
      if (Array.isArray(rawData.rows)) rawData = rawData.rows;
      else if (Array.isArray(rawData.data)) rawData = rawData.data;
      else rawData = [];
    }

    rawData = ensureArray(rawData);

    if (!rawData.length) {
      var emptyColumns = normalizeColumns(rawColumns, [], editable);
      return { rows: [], columns: emptyColumns };
    }

    if (Array.isArray(rawData[0])) {
      var arrayColumns = normalizeColumns(rawColumns, [], editable);
      if (!rawColumns || !rawColumns.length) {
        arrayColumns = rawData[0].map(function (_value, index) {
          return normalizeColumnObject("Column " + (index + 1), index, {}, editable);
        });
      }
      return { rows: rowsFromArrayRows(rawData, arrayColumns), columns: arrayColumns };
    }

    var objectRows = rowsFromObjectRows(rawData);
    var objectColumns = normalizeColumns(rawColumns, objectRows, editable);
    return { rows: objectRows, columns: objectColumns };
  }

  function escapeFormula(value) {
    if (typeof value !== "string") return value;
    if (dangerousFormulaPrefix.test(value)) return "'" + value;
    return value;
  }

  function sanitizeRowsForSpreadsheet(rows) {
    return rows.map(function (row) {
      var output = {};
      Object.keys(row).forEach(function (key) {
        output[key] = escapeFormula(row[key]);
      });
      return output;
    });
  }

  function csvEscape(value) {
    if (value == null) return "";
    var text = String(value);
    if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function toCsv(rows, columns, safeExport) {
    var exportRows = safeExport ? sanitizeRowsForSpreadsheet(rows) : rows;
    var fields = columns.map(function (column) { return column.field; });
    var headers = columns.map(function (column) { return column.title || column.field; });
    var lines = [headers.map(csvEscape).join(",")];

    exportRows.forEach(function (row) {
      lines.push(fields.map(function (field) {
        return csvEscape(row[field]);
      }).join(","));
    });

    return lines.join("\r\n");
  }

  function normalizeConfig(input) {
    var config = input || {};
    var styleInput = config.style || {};
    var style = {};
    Object.keys(defaults.style).forEach(function (key) {
      style[key] = styleInput[key] != null && styleInput[key] !== "" ? styleInput[key] : defaults.style[key];
    });

    return {
      dataInput: config.dataInput != null ? config.dataInput : [],
      columnsInput: config.columnsInput != null ? config.columnsInput : null,
      height: asSize(config.height, defaults.height),
      layout: config.layout || defaults.layout,
      editable: asBoolean(config.editable, defaults.editable),
      pagination: asBoolean(config.pagination, defaults.pagination),
      pageSize: asNumber(config.pageSize, defaults.pageSize),
      selectableRows: asBoolean(config.selectableRows, defaults.selectableRows),
      movableColumns: asBoolean(config.movableColumns, defaults.movableColumns),
      resizableColumns: asBoolean(config.resizableColumns, defaults.resizableColumns),
      placeholder: config.placeholder || defaults.placeholder,
      safeExport: asBoolean(config.safeExport, defaults.safeExport),
      sheetName: config.sheetName || defaults.sheetName,
      csvFileName: config.csvFileName || defaults.csvFileName,
      xlsxFileName: config.xlsxFileName || defaults.xlsxFileName,
      style: style
    };
  }

  function canvasElement(instance) {
    if (!instance || !instance.canvas) return null;
    if (instance.canvas.nodeType === 1) return instance.canvas;
    if (instance.canvas[0] && instance.canvas[0].nodeType === 1) return instance.canvas[0];
    if (typeof instance.canvas.get === "function") {
      var element = instance.canvas.get(0);
      if (element && element.nodeType === 1) return element;
    }
    return null;
  }

  function appendToCanvas(instance, element) {
    if (instance.canvas && typeof instance.canvas.append === "function") {
      instance.canvas.append(element);
      return;
    }
    var canvas = canvasElement(instance);
    if (canvas) canvas.appendChild(element);
  }

  function removeChildren(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function safePublish(adapter, name, value) {
    if (!adapter || typeof adapter.publish !== "function") return;
    try {
      adapter.publish(name, value);
    } catch (_error) {}
  }

  function safeTrigger(adapter, name) {
    if (!adapter || typeof adapter.trigger !== "function") return;
    try {
      adapter.trigger(name);
    } catch (_error) {}
  }

  function buildStyleText(id, style) {
    var rootClass = ".bst-" + id;
    return [
      rootClass + " { width:100%; height:100%; min-height:80px; color:" + style.text + "; font-size:" + Number(style.fontSize) + "px; }",
      rootClass + " .bst-fallback-table { width:100%; border-collapse:collapse; table-layout:fixed; }",
      rootClass + " .bst-fallback-table th { background:" + style.headerBackground + "; color:" + style.headerText + "; border:1px solid " + style.border + "; height:" + Number(style.rowHeight) + "px; padding:6px 8px; text-align:left; }",
      rootClass + " .bst-fallback-table td { background:" + style.rowBackground + "; color:" + style.text + "; border:1px solid " + style.border + "; height:" + Number(style.rowHeight) + "px; padding:6px 8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }",
      rootClass + " .bst-fallback-table tbody tr:nth-child(even) td { background:" + style.alternateRowBackground + "; }",
      rootClass + " .bst-fallback-table tbody tr.is-selected td { outline:2px solid " + style.accent + "; outline-offset:-2px; }",
      rootClass + " .tabulator { border-color:" + style.border + "; color:" + style.text + "; font-size:" + Number(style.fontSize) + "px; }",
      rootClass + " .tabulator .tabulator-header { background:" + style.headerBackground + "; border-color:" + style.border + "; color:" + style.headerText + "; }",
      rootClass + " .tabulator .tabulator-header .tabulator-col { background:" + style.headerBackground + "; border-color:" + style.border + "; color:" + style.headerText + "; }",
      rootClass + " .tabulator-row { min-height:" + Number(style.rowHeight) + "px; background:" + style.rowBackground + "; color:" + style.text + "; }",
      rootClass + " .tabulator-row.tabulator-row-even { background:" + style.alternateRowBackground + "; }",
      rootClass + " .tabulator-row .tabulator-cell { border-color:" + style.border + "; }",
      rootClass + " .tabulator-row.tabulator-selected { background:" + style.accent + "22; }"
    ].join("\n");
  }

  function installScopedStyle(id, style) {
    if (!root.document) return null;
    var styleElement = root.document.querySelector("style[data-bst-style='" + id + "']");
    if (!styleElement) {
      styleElement = root.document.createElement("style");
      styleElement.setAttribute("data-bst-style", id);
      root.document.head.appendChild(styleElement);
    }
    styleElement.textContent = buildStyleText(id, style);
    return styleElement;
  }

  function downloadBlob(blob, fileName) {
    if (!root.document || !root.URL) return;
    var url = root.URL.createObjectURL(blob);
    var anchor = root.document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    root.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    root.setTimeout(function () {
      root.URL.revokeObjectURL(url);
    }, 0);
  }

  function buildXlsxWorkbook(XLSX, rows, columns, safeExport, sheetName) {
    var exportRows = safeExport ? sanitizeRowsForSpreadsheet(rows) : rows;
    var orderedRows = exportRows.map(function (row) {
      var item = {};
      columns.forEach(function (column) {
        item[column.title || column.field] = row[column.field];
      });
      return item;
    });
    var worksheet = XLSX.utils.json_to_sheet(orderedRows);
    var workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || defaults.sheetName);
    return workbook;
  }

  function TableController(container, adapter) {
    if (!container) throw new Error("A container element is required");
    this.container = container;
    this.adapter = adapter || {};
    this.id = "bst" + (++instanceSeq);
    this.container.classList.add("bst-root", "bst-" + this.id);
    this.table = null;
    this.styleElement = null;
    this.config = normalizeConfig({});
    this.rows = [];
    this.columns = [];
    this.dirty = false;
    this.selectedRows = [];
    this.changedCell = null;
    this.validationErrors = [];
    this.lastSignature = "";
    this.publishTimer = null;
    this.readyTriggered = false;
    this.tableDataReady = false;
    this.pendingRenderInput = null;
    this.pendingRenderCallbacks = [];
  }

  TableController.prototype.render = function (input) {
    var config = normalizeConfig(input);
    var normalized = normalizeData(config.dataInput, config.columnsInput, config.editable);
    var signature = JSON.stringify({
      config: config,
      rows: normalized.rows,
      columns: normalized.columns
    });

    if (this.table && !this.tableDataReady) {
      this.config = config;
      this.rows = normalized.rows;
      this.columns = normalized.columns;
      this.pendingRenderInput = Object.assign({}, config, {
        dataInput: normalized.rows,
        columnsInput: normalized.columns
      });
      this.publishAll();
      return;
    }

    if (signature === this.lastSignature) {
      this.publishAll();
      return;
    }

    this.config = config;
    this.rows = normalized.rows;
    this.columns = normalized.columns;
    this.validationErrors = [];
    this.lastSignature = signature;
    this.selectedRows = [];
    this.changedCell = null;

    this.destroyTable();
    this.styleElement = installScopedStyle(this.id, config.style);
    this.container.style.height = config.height;

    if (root.Tabulator) {
      this.renderTabulator();
    } else {
      this.renderFallback();
    }

    this.publishAll();
    if (!this.readyTriggered) {
      this.readyTriggered = true;
      safeTrigger(this.adapter, "ready");
    }
  };

  TableController.prototype.flushPendingRender = function () {
    if (!this.pendingRenderInput) return false;
    var pendingInput = this.pendingRenderInput;
    var callbacks = this.pendingRenderCallbacks.slice();
    this.pendingRenderInput = null;
    this.pendingRenderCallbacks = [];
    this.render(pendingInput);
    callbacks.forEach(function (callback) {
      if (typeof callback === "function") callback();
    });
    return true;
  };

  TableController.prototype.destroyTable = function () {
    if (this.table && typeof this.table.destroy === "function") {
      this.table.destroy();
    }
    this.table = null;
    removeChildren(this.container);
  };

  TableController.prototype.renderTabulator = function () {
    var self = this;
    this.tableDataReady = false;
    var options = {
      data: clone(this.rows),
      columns: clone(this.columns),
      layout: this.config.layout,
      height: this.config.height,
      placeholder: this.config.placeholder,
      movableColumns: this.config.movableColumns,
      resizableColumnFit: this.config.resizableColumns,
      selectableRows: this.config.selectableRows ? true : false,
      columnDefaults: {
        resizable: this.config.resizableColumns,
        headerSort: true
      }
    };

    if (this.config.pagination) {
      options.pagination = "local";
      options.paginationSize = this.config.pageSize;
    }

    this.table = new root.Tabulator(this.container, options);

    if (typeof this.table.on === "function") {
      this.table.on("tableBuilt", function () {
        self.tableDataReady = true;
        if (self.flushPendingRender()) return;
        self.rows = self.getData();
        self.publishAll();
      });

      this.table.on("dataLoaded", function () {
        self.tableDataReady = true;
        if (self.flushPendingRender()) return;
        self.rows = self.getData();
        self.publishAll();
      });

      this.table.on("cellEdited", function (cell) {
        self.tableDataReady = true;
        var row = cell.getRow ? cell.getRow() : null;
        var rowData = row && row.getData ? row.getData() : {};
        self.rows = self.getData();
        self.dirty = true;
        self.changedCell = {
          field: cell.getField ? cell.getField() : "",
          value: cell.getValue ? cell.getValue() : null,
          row: rowData,
          rowIndex: row && row.getPosition ? row.getPosition(true) : null
        };
        self.publishAll();
        safeTrigger(self.adapter, "cell_changed");
        safeTrigger(self.adapter, "data_changed");
      });

      this.table.on("rowSelectionChanged", function (data) {
        self.tableDataReady = true;
        self.selectedRows = clone(data || []);
        self.publishAll();
        safeTrigger(self.adapter, "row_selected");
      });
    }
  };

  TableController.prototype.renderFallback = function () {
    var self = this;
    var table = root.document.createElement("table");
    table.className = "bst-fallback-table";
    var thead = root.document.createElement("thead");
    var headerRow = root.document.createElement("tr");
    this.columns.forEach(function (column) {
      var th = root.document.createElement("th");
      th.textContent = column.title || column.field;
      if (column.width) th.style.width = typeof column.width === "number" ? column.width + "px" : column.width;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = root.document.createElement("tbody");
    this.rows.forEach(function (row, rowIndex) {
      var tr = root.document.createElement("tr");
      tr.addEventListener("click", function () {
        Array.prototype.forEach.call(tbody.querySelectorAll("tr"), function (node) {
          node.classList.remove("is-selected");
        });
        tr.classList.add("is-selected");
        self.selectedRows = [clone(row)];
        self.publishAll();
        safeTrigger(self.adapter, "row_selected");
      });

      self.columns.forEach(function (column) {
        var td = root.document.createElement("td");
        td.textContent = row[column.field] == null ? "" : String(row[column.field]);
        if (self.config.editable) {
          td.contentEditable = "true";
          td.addEventListener("blur", function () {
            var value = td.textContent;
            self.rows[rowIndex][column.field] = value;
            self.dirty = true;
            self.changedCell = {
              field: column.field,
              value: value,
              row: clone(self.rows[rowIndex]),
              rowIndex: rowIndex
            };
            self.publishAll();
            safeTrigger(self.adapter, "cell_changed");
            safeTrigger(self.adapter, "data_changed");
          });
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    this.container.appendChild(table);
  };

  TableController.prototype.getData = function () {
    if (this.table && typeof this.table.getData === "function") {
      var data = this.table.getData();
      if (!this.tableDataReady && this.rows.length && !data.length) return clone(this.rows);
      return clone(data);
    }
    return clone(this.rows);
  };

  TableController.prototype.getSelectedRows = function () {
    if (this.table && typeof this.table.getSelectedData === "function") {
      return clone(this.table.getSelectedData());
    }
    return clone(this.selectedRows);
  };

  TableController.prototype.replaceRows = function (rows, after) {
    var self = this;
    this.rows = clone(rows);
    if (this.table && !this.tableDataReady) {
      this.pendingRenderCallbacks.push(after);
      this.render(Object.assign({}, this.config, {
        dataInput: rows,
        columnsInput: this.columns
      }));
      return;
    }
    if (this.table && typeof this.table.setData === "function") {
      var result = this.table.setData(clone(rows));
      if (result && typeof result.then === "function") {
        result.then(function () {
          self.rows = self.getData();
          if (typeof after === "function") after();
        });
        return;
      }
      if (typeof after === "function") after();
      return;
    }
    this.render(Object.assign({}, this.config, {
      dataInput: rows,
      columnsInput: this.columns
    }));
    if (typeof after === "function") after();
  };

  TableController.prototype.publishAll = function () {
    var data = this.getData();
    var selectedRows = this.getSelectedRows();
    safePublish(this.adapter, "data_json", JSON.stringify(data));
    safePublish(this.adapter, "row_count", data.length);
    safePublish(this.adapter, "selected_row_json", selectedRows.length ? JSON.stringify(selectedRows[0]) : "");
    safePublish(this.adapter, "selected_rows_json", JSON.stringify(selectedRows));
    safePublish(this.adapter, "changed_cell_json", this.changedCell ? JSON.stringify(this.changedCell) : "");
    safePublish(this.adapter, "validation_errors_json", JSON.stringify(this.validationErrors));
    safePublish(this.adapter, "is_dirty", this.dirty);
  };

  TableController.prototype.setData = function (dataInput, columnsInput) {
    this.render({
      dataInput: dataInput,
      columnsInput: columnsInput != null ? columnsInput : this.config.columnsInput,
      height: this.config.height,
      layout: this.config.layout,
      editable: this.config.editable,
      pagination: this.config.pagination,
      pageSize: this.config.pageSize,
      selectableRows: this.config.selectableRows,
      movableColumns: this.config.movableColumns,
      resizableColumns: this.config.resizableColumns,
      placeholder: this.config.placeholder,
      safeExport: this.config.safeExport,
      sheetName: this.config.sheetName,
      csvFileName: this.config.csvFileName,
      xlsxFileName: this.config.xlsxFileName,
      style: this.config.style
    });
  };

  TableController.prototype.addRow = function (rowInput) {
    var row = parseJsonInput(rowInput, {}, "row_json");
    if (!isPlainObject(row)) throw new Error("row_json must be an object");
    var nextRows = this.getData();
    nextRows.push(row);
    var self = this;
    this.replaceRows(nextRows, function () {
      self.dirty = true;
      self.publishAll();
      safeTrigger(self.adapter, "data_changed");
    });
  };

  TableController.prototype.deleteSelectedRows = function () {
    var self = this;
    var selectedRows = this.getSelectedRows();
    if (selectedRows.length) {
      var serialized = selectedRows.map(function (row) { return JSON.stringify(row); });
      this.rows = this.getData().filter(function (row) {
        return serialized.indexOf(JSON.stringify(row)) === -1;
      });
      this.replaceRows(this.rows, function () {
        self.dirty = true;
        self.publishAll();
        safeTrigger(self.adapter, "data_changed");
      });
      return;
    }
    this.publishAll();
  };

  TableController.prototype.clearDirty = function () {
    this.dirty = false;
    this.changedCell = null;
    this.publishAll();
  };

  TableController.prototype.refresh = function () {
    if (this.table && !this.tableDataReady) {
      this.publishAll();
      return;
    }
    if (this.table && typeof this.table.redraw === "function") {
      try {
        this.table.redraw(true);
      } catch (_error) {
        var self = this;
        if (root.setTimeout) {
          root.setTimeout(function () {
            if (self.table && typeof self.table.redraw === "function") {
              try {
                self.table.redraw(true);
              } catch (_laterError) {}
            }
          }, 0);
        }
      }
    }
    this.publishAll();
  };

  TableController.prototype.csvString = function (safeExport) {
    var useSafeExport = safeExport == null ? this.config.safeExport : safeExport;
    return toCsv(this.getData(), this.columns, useSafeExport);
  };

  TableController.prototype.downloadCSV = function (fileName) {
    var name = fileName || this.config.csvFileName || defaults.csvFileName;
    var csv = this.csvString(this.config.safeExport);
    var blob = new root.Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, name);
  };

  TableController.prototype.buildXlsxWorkbook = function (sheetName) {
    if (!root.XLSX) throw new Error("SheetJS XLSX is not loaded");
    return buildXlsxWorkbook(root.XLSX, this.getData(), this.columns, this.config.safeExport, sheetName || this.config.sheetName);
  };

  TableController.prototype.downloadXLSX = function (fileName, sheetName) {
    if (!root.XLSX) {
      this.validationErrors = ["SheetJS XLSX is not loaded"];
      this.publishAll();
      safeTrigger(this.adapter, "export_failed");
      throw new Error("SheetJS XLSX is not loaded");
    }
    var workbook = this.buildXlsxWorkbook(sheetName);
    root.XLSX.writeFile(workbook, fileName || this.config.xlsxFileName || defaults.xlsxFileName);
  };

  function readBubbleProperties(properties) {
    properties = properties || {};
    var dataInput = parseJsonInput(properties.data_json, [], "data_json");
    var columnsInput = parseJsonInput(properties.columns_json, null, "columns_json");
    var columnDefaults = parseJsonInput(properties.column_defaults_json, {}, "column_defaults_json");

    if (Array.isArray(columnsInput) && isPlainObject(columnDefaults) && Object.keys(columnDefaults).length) {
      columnsInput = columnsInput.map(function (column) {
        if (typeof column === "string") return Object.assign({}, columnDefaults, { title: column });
        return Object.assign({}, columnDefaults, column);
      });
    }

    return {
      dataInput: dataInput,
      columnsInput: columnsInput,
      height: properties.table_height,
      layout: properties.layout,
      editable: properties.editable,
      pagination: properties.pagination,
      pageSize: properties.page_size,
      selectableRows: properties.selectable_rows,
      movableColumns: properties.movable_columns,
      resizableColumns: properties.resizable_columns,
      placeholder: properties.placeholder,
      safeExport: properties.safe_export,
      sheetName: properties.sheet_name,
      csvFileName: properties.csv_file_name,
      xlsxFileName: properties.xlsx_file_name,
      style: {
        headerBackground: properties.header_background_color,
        headerText: properties.header_text_color,
        rowBackground: properties.row_background_color,
        alternateRowBackground: properties.alternate_row_background_color,
        text: properties.text_color,
        border: properties.border_color,
        accent: properties.accent_color,
        fontSize: properties.font_size,
        rowHeight: properties.row_height
      }
    };
  }

  function bubbleInitialize(instance, context) {
    instance.data = instance.data || {};
    var host = root.document.createElement("div");
    host.className = "bst-host";
    appendToCanvas(instance, host);

    instance.data.bst = new TableController(host, {
      publish: function (name, value) {
        if (typeof instance.publishState === "function") instance.publishState(name, value);
      },
      trigger: function (name) {
        if (typeof instance.triggerEvent === "function") instance.triggerEvent(name);
      },
      context: context
    });

    instance.data.bst.publishAll();
  }

  function bubbleUpdate(instance, properties, context) {
    if (!instance.data || !instance.data.bst) bubbleInitialize(instance, context);
    try {
      instance.data.bst.render(readBubbleProperties(properties));
    } catch (error) {
      instance.data.bst.validationErrors = [error.message];
      instance.data.bst.publishAll();
      safeTrigger(instance.data.bst.adapter, "export_failed");
      if (properties && properties.debug) throw error;
    }
  }

  function getController(instance) {
    if (!instance || !instance.data || !instance.data.bst) {
      throw new Error("Spreadsheet Table is not initialized");
    }
    return instance.data.bst;
  }

  var bubbleActions = {
    setData: function (instance, properties) {
      var controller = getController(instance);
      var data = parseJsonInput(properties.data_json, [], "data_json");
      var columns = parseJsonInput(properties.columns_json, null, "columns_json");
      controller.setData(data, columns);
    },
    downloadCSV: function (instance, properties) {
      getController(instance).downloadCSV(properties && properties.file_name);
    },
    downloadXLSX: function (instance, properties) {
      getController(instance).downloadXLSX(properties && properties.file_name, properties && properties.sheet_name);
    },
    refresh: function (instance) {
      getController(instance).refresh();
    },
    clearDirty: function (instance) {
      getController(instance).clearDirty();
    },
    addRow: function (instance, properties) {
      getController(instance).addRow(properties && properties.row_json);
    },
    deleteSelectedRows: function (instance) {
      getController(instance).deleteSelectedRows();
    }
  };

  return {
    version: VERSION,
    defaults: defaults,
    create: function (container, adapter) {
      return new TableController(container, adapter);
    },
    parseJsonInput: parseJsonInput,
    normalizeData: normalizeData,
    normalizeConfig: normalizeConfig,
    escapeFormula: escapeFormula,
    sanitizeRowsForSpreadsheet: sanitizeRowsForSpreadsheet,
    toCsv: toCsv,
    buildXlsxWorkbook: buildXlsxWorkbook,
    bubble: {
      initialize: bubbleInitialize,
      update: bubbleUpdate,
      readProperties: readBubbleProperties,
      actions: bubbleActions
    }
  };
});
