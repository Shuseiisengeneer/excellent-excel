# Bubble Spreadsheet Table Plugin

JSONを入力すると編集可能な表として表示し、編集後の表データをJSON stateとしてBubbleに返すElement実装です。CSV/XLSX出力にも対応します。
表上部のツールバーから、Preview/Run画面上で行追加、列追加、選択行削除もできます。

## 構成

- `src/bubble-table-core.js`: Bubble非依存の共通実装です。Tabulatorが読み込まれていればTabulatorで描画し、未読込なら安全なHTML tableにフォールバックします。
- `plugin/`: Bubble Plugin Editorへ貼るコードとフィールド定義です。
- `vendor/`: 固定バージョンのTabulator/SheetJSです。CDNではなくBubble Shared assetsに置きたい場合に使います。
- `demo/index.html`: Bubbleの `instance` と `properties` を模したローカル検証画面です。
- `tests/`: NodeとPlaywrightによる自動テストです。
- `dist/`: `npm run build` で生成される貼り付け用成果物です。

## Bubbleへの入れ方

1. Bubble Plugin Editorで新しいElementを作り、名前を `Spreadsheet Table` にします。
2. `plugin/element-fields.md` の通りにFields、Exposed states、Events、Element actionsを作ります。
3. Shared HTML Headerには、どちらかを使います。
   - CDN運用: `plugin/shared_header_cdn.html`
   - Bubble Shared assets運用: `plugin/shared_header_local_assets.html`
   - 1ファイル貼り付け運用: `dist/shared_header_inline.html`
4. `src/bubble-table-core.js` をBubble Shared assetsにアップロードし、Shared Header内のURLを差し替えます。
5. ElementのInitializeに `plugin/element-initialize.js`、Updateに `plugin/element-update.js` の中身を貼ります。
6. Element actionsには `plugin/actions/*.js` をそれぞれ貼ります。
7. Test appにElementを置き、`data_json` に次のようなJSONを入れます。

```json
[
  { "Name": "Widget", "Qty": 2, "Note": "Normal text" },
  { "Name": "Service", "Qty": 1, "Note": "Editable" }
]
```

`columns_json` は省略できます。列順・列幅・表示名を制御する場合は次を使います。

```json
[
  { "title": "Name", "field": "Name", "width": 220 },
  { "title": "Qty", "field": "Qty", "hozAlign": "right", "width": 90 },
  { "title": "Note", "field": "Note", "width": 360 }
]
```

## 返却されるstate

- `data_json`: 現在の表データ。Bubble側で保存や後続workflowに渡せます。
- `row_count`: 行数。
- `selected_row_json`: 選択中の先頭行。
- `selected_rows_json`: 選択行一覧。
- `changed_cell_json`: 最後に編集されたセル。
- `validation_errors_json`: JSON不正やXLSXライブラリ未読込などのエラー。
- `is_dirty`: 表示後に編集・追加・削除があったか。

## 画面上の編集

デフォルトでは表の上に小さなツールバーが表示されます。

- `+ Row`: 空行を追加します。
- `+ Column`: 列名を入力して列を追加します。
- `Delete Row`: 選択中の行を削除します。

ツールバーを非表示にしたい場合は、Plugin EditorでField `show_toolbar` を追加し、Element側でnoにしてください。Fieldを作らない場合はデフォルトで表示されます。

見た目を細かく詰めたい場合は、以下のようなFieldを使います。

- `font_family`
- `border_radius`
- `row_hover_background_color`
- `selected_row_background_color`
- `toolbar_background_color`
- `toolbar_button_*`
- `cell_padding_x` / `cell_padding_y`
- `table_shadow`

セルレイアウトも全列共通でいじれます。

- `default_column_align` (`left` / `center` / `right`)：全セルの横揃え既定
- `default_header_align`：全ヘッダの横揃え既定
- `default_column_width`：列幅の既定（空ならauto）
- `header_height`：ヘッダ行の高さ
- `show_grid`：グリッド線（セル境界線）のオンオフ

列ごとに個別指定したい場合は `columns_json` の各オブジェクトに `width`, `hozAlign`, `headerHozAlign` 等を入れれば、デフォルトより優先されます。

さらに自由度が必要なら `style_overrides_json` で内部スタイル名を直接上書きできます。ExplicitなFieldより後に適用されるため、細かい微調整用です。

## セキュリティ上の扱い

- セル値はHTMLとしてではなくテキストとして扱います。
- CSV/XLSX出力時は、`safe_export` がtrueなら `=`, `+`, `-`, `@` などで始まる値に `'` を付け、CSV/Formula Injectionを抑止します。
- BubbleのElementはクライアント側で動くため、秘密情報や見せてはいけないデータを `data_json` に含めないでください。

## ローカル検証

```bash
npm run build
npm test
```

テスト内容:

- JSON正規化、列定義、CSVエスケープの単体テスト
- Playwrightで `demo/index.html` を開き、Tabulator実体で描画されること
- Bubble Plugin Editorに貼るInitialize/Update/Actionスニペット自体がブラウザ上で動くこと
- Bubble stateがpublishされること
- SheetJSでWorkbookが作れること
- XSS文字列が実行されないこと
- merge conflict markerがないこと

## Bubble実機確認

Bubble Plugin Editorに貼り込んだ後、Test appのPreview/Run mode URLを指定して確認します。

```bash
BUBBLE_PREVIEW_URL="https://your-app.bubbleapps.io/version-test/your-page" npm run verify:bubble
```

ログインが必要なPreviewの場合:

```bash
npm run verify:bubble -- --url "https://your-app.bubbleapps.io/version-test/your-page" --headed --user-data-dir .playwright-bubble-profile
```

詳細は [docs/bubble-runtime-verification.md](docs/bubble-runtime-verification.md) です。

## 未完了の実機確認

このリポジトリ側ではBubble互換のコードとローカルブラウザ検証まで行えます。最終的に「Bubbleのプラグインに入れて問題なく動く」と言い切るには、Bubble Plugin Editorの実テストアプリに貼り込んでPreview/Run modeで確認する必要があります。
