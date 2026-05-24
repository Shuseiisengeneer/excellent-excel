# Bubble Plugin Verification Checklist

## Plugin Editor

- Shared HeaderにTabulator CSS/JS、SheetJS、`bubble-table-core.js` がこの順で読み込まれている。
- Element fieldsのキーが `plugin/element-fields.md` と一致している。
- Exposed statesのキーと型が一致している。
- Eventsが `ready`, `data_changed`, `row_selected`, `cell_changed`, `export_failed` で作られている。
- Initialize/Updateに `plugin/element-initialize.js` と `plugin/element-update.js` の中身を貼っている。
- Element actionsに `plugin/actions/*.js` を貼っている。

## Test App

- Elementをページに配置し、幅と高さを与える。
- `data_json` に配列JSONを入れると表が表示される。
- `columns_json` なしでも列が推定される。
- `columns_json` ありで列順、表示名、幅が反映される。
- セル編集後に `data_json`, `changed_cell_json`, `is_dirty` が更新される。
- 行選択後に `selected_row_json` と `selected_rows_json` が更新される。
- `Set data` actionで表が差し替わる。
- `Add row` actionで行が増える。
- `Delete selected rows` actionで選択行が消える。
- `Download CSV` actionでCSVが落ちる。
- `Download XLSX` actionでXLSXが落ちる。
- Consoleにerrorが出ない。
- Responsive幅を変えても表が破綻しない。

## Security

- HTMLタグ風のセル値が実行されず、文字列として表示される。
- `=`, `+`, `-`, `@` で始まる値がCSV出力で `'` 付きになる。
- API key、個人情報、非公開データをElement propertyへ渡していない。

## Release

- CDN運用ならURLが固定バージョンになっている。
- Shared assets運用ならvendorファイルとcoreファイルのURLが正しい。
- Marketplaceに出す場合はデモアプリが実プラグインを使っている。
- Plugin descriptionにTabulator、SheetJS、データはクライアント側で処理されることを明記している。
