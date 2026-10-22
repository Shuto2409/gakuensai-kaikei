# じゃがバター屋 会計システム

学園祭の模擬店向け Web POS。GitHub Pages + Supabase で動きます。

## ファイル構成
- `index.html` … 画面のHTML（部品を読み込むだけ）
- `css/` … 見た目（base=共通/ホーム, cashier=会計, kitchen=調理・受け渡し, admin=管理, shift=シフト, ticket-compact=カード）
- `js/` … プログラム（読み込み順は index.html のとおり）
  - `config.js` バージョン / `db.js` Supabase接続 / `state.js` 状態・画面切替 / `roles.js` 役割選択・購読
  - `menu.js` レジのメニュー / `cart-payment.js` カート・会計 / `kitchen-handoff.js` 調理・受け渡し
  - `admin-core.js` 管理(整理券・バザー券・営業・売上・在庫) / `menu-admin.js` メニュー登録
  - `orders-modals.js` 取消・選択・PIN / `export-utils.js` 出力・共通 / `shift.js` シフト / `accounts.js` ログイン / `boot.js` 起動
- `setup.sql` … Supabase の初期設定SQL

## 更新するとき
1. 変更したファイルを GitHub にアップロード（上書き）
2. `js/config.js` の `APP_VERSION` を上げ、`index.html` の `?v=` も同じ番号にする
   （端末に古いファイルが残るのを防ぎます）
