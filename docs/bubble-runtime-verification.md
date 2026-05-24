# Bubble Runtime Verification

このファイルは、Bubble Plugin Editorに実際に貼り込んだ後の最終確認手順です。

## 1. Test app側で用意するページ

BubbleのTest appに `Spreadsheet Table` Elementを1つ配置します。

Element properties:

- `data_json`

```json
[
  { "Name": "Widget", "Qty": 2, "Note": "Normal text" },
  { "Name": "Service", "Qty": 1, "Note": "Editable" }
]
```

- `columns_json`

```json
[
  { "title": "Name", "field": "Name", "width": 220 },
  { "title": "Qty", "field": "Qty", "hozAlign": "right", "width": 90 },
  { "title": "Note", "field": "Note", "width": 360 }
]
```

Recommended property values:

- `table_height`: `420px`
- `layout`: `fitColumns`
- `editable`: yes
- `safe_export`: yes
- `font_size`: `14`
- `row_height`: `36`

## 2. 自動確認

Preview/Run modeのURLを指定して実行します。

```bash
BUBBLE_PREVIEW_URL="https://your-app.bubbleapps.io/version-test/your-page" npm run verify:bubble
```

ログインが必要なPreviewの場合は、ブラウザを表示して手動ログインできる形で実行します。

```bash
npm run verify:bubble -- --url "https://your-app.bubbleapps.io/version-test/your-page" --headed --user-data-dir .playwright-bubble-profile
```

生成される証跡:

- `evidence/bubble-runtime-*.json`
- `evidence/bubble-runtime-*.png`

## 3. 合格条件

JSON証跡の `assertions` がすべてtrueであること。

- `core_loaded`: `window.BubbleSpreadsheetTable` が存在する
- `table_root_present`: Element rootが存在する
- `table_dom_present`: Tabulatorまたはfallback tableが存在する
- `rows_rendered`: 行が描画されている
- `cells_rendered`: セルが描画されている
- `no_page_errors`: page errorがない
- `no_console_errors`: console errorがない

`edit_result.changed` がtrueであれば、画面上のセル編集も通っています。
