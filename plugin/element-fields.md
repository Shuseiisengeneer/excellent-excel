# Bubble Element Definition

Create one visual element named `Spreadsheet Table`.

## Fields

Use these field keys exactly; the JavaScript snippets read `properties.<key>`.

| Key | Editor type | Data type / options | Optional | In style |
| --- | --- | --- | --- | --- |
| `data_json` | Dynamic value | text | no | no |
| `columns_json` | Dynamic value | text | yes | no |
| `column_defaults_json` | Static Text | text | yes | no |
| `table_height` | Static Text | text | yes | yes |
| `layout` | Dropdown | `fitColumns,fitData,fitDataStretch,fitDataFill` | yes | yes |
| `editable` | Checkbox | yes/no | yes | no |
| `pagination` | Checkbox | yes/no | yes | no |
| `page_size` | Static Number | number | yes | no |
| `selectable_rows` | Checkbox | yes/no | yes | no |
| `movable_columns` | Checkbox | yes/no | yes | no |
| `resizable_columns` | Checkbox | yes/no | yes | no |
| `show_toolbar` | Checkbox | yes/no | yes | yes |
| `placeholder` | Static Text | text | yes | yes |
| `safe_export` | Checkbox | yes/no | yes | no |
| `sheet_name` | Static Text | text | yes | no |
| `csv_file_name` | Static Text | text | yes | no |
| `xlsx_file_name` | Static Text | text | yes | no |
| `header_background_color` | Color | color | yes | yes |
| `header_text_color` | Color | color | yes | yes |
| `row_background_color` | Color | color | yes | yes |
| `alternate_row_background_color` | Color | color | yes | yes |
| `text_color` | Color | color | yes | yes |
| `border_color` | Color | color | yes | yes |
| `accent_color` | Color | color | yes | yes |
| `font_size` | Static Number | number | yes | yes |
| `row_height` | Static Number | number | yes | yes |
| `debug` | Checkbox | yes/no | yes | no |

Recommended defaults:

```json
{
  "data_json": "[{\"Name\":\"Sample\",\"Qty\":1}]",
  "columns_json": "[{\"title\":\"Name\",\"field\":\"Name\",\"width\":180},{\"title\":\"Qty\",\"field\":\"Qty\",\"hozAlign\":\"right\"}]",
  "table_height": "360px",
  "layout": "fitColumns",
  "editable": true,
  "pagination": false,
  "page_size": 25,
  "selectable_rows": true,
  "movable_columns": true,
  "resizable_columns": true,
  "show_toolbar": true,
  "placeholder": "No data",
  "safe_export": true,
  "sheet_name": "Sheet1",
  "csv_file_name": "table.csv",
  "xlsx_file_name": "table.xlsx",
  "header_background_color": "#f8fafc",
  "header_text_color": "#0f172a",
  "row_background_color": "#ffffff",
  "alternate_row_background_color": "#f8fafc",
  "text_color": "#111827",
  "border_color": "#d1d5db",
  "accent_color": "#2563eb",
  "font_size": 14,
  "row_height": 36
}
```

## Exposed states

| Key | Type | List |
| --- | --- | --- |
| `data_json` | text | no |
| `row_count` | number | no |
| `selected_row_json` | text | no |
| `selected_rows_json` | text | no |
| `changed_cell_json` | text | no |
| `validation_errors_json` | text | no |
| `is_dirty` | yes/no | no |

## Events

| Key |
| --- |
| `ready` |
| `data_changed` |
| `row_selected` |
| `cell_changed` |
| `export_failed` |

## Element actions

| Action | Fields |
| --- | --- |
| `Set data` | `data_json` dynamic text, `columns_json` dynamic text optional |
| `Download CSV` | `file_name` static text optional |
| `Download XLSX` | `file_name` static text optional, `sheet_name` static text optional |
| `Refresh` | none |
| `Clear dirty` | none |
| `Add row` | `row_json` dynamic text |
| `Delete selected rows` | none |
