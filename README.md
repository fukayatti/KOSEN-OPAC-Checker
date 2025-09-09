# KOSEN-OPAC-Checker

Amazon・楽天ブックスの書籍ページに図書館の蔵書情報を自動的に表示する Chrome 拡張機能です。

## 🚀 機能

- **自動検索**: Amazon・楽天ブックスの書籍ページを開くと、自動的に図書館の蔵書を検索
- **ISBN 検索**: 正確な書籍情報で検索
- **マルチサイト対応**: Amazon と楽天ブックスの両方で使用可能
- **自然な UI**: 各サイトのデザインに合わせたネイティブなボタンデザイン
- **最適配置**: 「買い物かごに入れる」ボタンの下に自然に配置
- **詳細情報表示**: 図書館の蔵書詳細情報を表示
- **ワンクリックアクセス**: 図書館の詳細ページに直接リンク

## 🎨 デザインの特徴

### Amazon 対応

- Amazon 公式スタイルの完全再現
- 「今すぐ買う」ボタンと同様のデザイン
- 購入ボタンエリアに自然に統合

### 楽天ブックス対応

- 楽天市場のデザインガイドラインに準拠
- 買い物かごボタンの下に自然に配置
- 楽天風のグラデーションとスタイル

## 📦 インストール方法

### 開発版（手動インストール）

1. このプロジェクトをクローンまたはダウンロード
2. Chrome を開く
3. `chrome://extensions/` にアクセス
4. 右上の「デベロッパーモード」を有効にする
5. 「パッケージ化されていない拡張機能を読み込む」をクリック
6. `Library` フォルダを選択（プロジェクトのルートディレクトリ）

## 🎯 使用方法

### Amazon での使用

1. Amazon.co.jp の書籍ページにアクセス
2. ページが読み込まれると、自動的に図書館の蔵書を検索
3. 「今すぐ買う」ボタンの下に図書館ボタンが表示

### 楽天ブックスでの使用

1. books.rakuten.co.jp の書籍ページにアクセス
2. ページが読み込まれると、自動的に図書館の蔵書を検索
3. 「買い物かごに入れる」ボタンの下に図書館ボタンが表示

### ボタンの種類

- 📚 **図書館で借りる（青色）**: 蔵書がある場合
- **図書館にはありません（グレー）**: 蔵書がない場合

## 📋 対応サイト

- **Amazon.co.jp**: 書籍ページ
- **楽天ブックス**: books.rakuten.co.jp の書籍ページ
- **図書館システム**: WebOPAC (libopac-c.kosen-k.go.jp)

## 🔧 技術仕様

### ファイル構成

```text
Library/
├── manifest.json          # 拡張機能の設定
├── content.js             # Amazon ページに注入されるスクリプト
├── content.css            # UI スタイル（Amazon完全準拠）
├── background.js          # バックグラウンドでの検索処理
├── popup.html             # 拡張機能ポップアップ
├── test-amazon-ui.html    # UIテスト用ページ
├── icons/                 # アイコンファイル
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── working_scraper.js     # 元のスクレイピングスクリプト
└── sample.html            # 検索結果のサンプルHTML
```

### Amazon CSS 統合

拡張機能は以下の順序でスタイルを適用します：

1. **Amazon 公式 CSS 読み込み**: 指定された URL から動的に読み込み
2. **拡張機能 CSS 適用**: `content.css`で Amazon スタイルを完全再現
3. **JavaScript 強制適用**: `applyAmazonButtonStyles()`で確実にスタイル適用

```javascript
// 使用されるAmazon公式CSS URL
const amazonCSSUrl = "https://m.media-amazon.com/images/I/11VHci0R+LL._RC%7C...";

// 適用されるクラス
.library-finder-amazon-native          // 基本のAmazonボタンスタイル
.library-finder-amazon-primary         // プライマリスタイル（青色）
.a-button .a-button-inner .a-button-input .a-button-text  // Amazon公式クラス
```

### 検索ロジック（フォールバック戦略）

1. **ISBN 検索（最優先）**:

   - ISBN-13 または ISBN-10 を抽出
   - WebOPAC の詳細検索 API を使用
   - 最も正確な検索方法

2. **タイトル全文検索（フォールバック 1）**:

   - ISBN 検索で見つからない場合
   - 書籍タイトルをそのまま使用
   - Amazon 固有の文言のみ除去

3. **メインタイトル+著者検索（フォールバック 2）**:

   - タイトル全文検索で見つからない場合
   - タイトルの最初の区切り文字まで + 主著者名
   - より精密な検索クエリ

4. **段階的精度調整**:
   - 各段階で検索精度を調整
   - 検索結果が 0 件の場合、次の戦略に移行
   - 全戦略失敗時は「見つからない」と判定

### UI 表示戦略

#### デュアルコンテナアーキテクチャ

1. **ボタンコンテナ**: 購入ボタンエリアに図書館ボタンを配置
2. **詳細コンテナ**: Keepa 風の詳細情報を価格情報エリアに配置

#### ボタン配置の優先順位

```javascript
// 1. 「今すぐ買う」ボタンの直後
const buyNowSelectors = [
  "#buy-now-button",
  'input[name="submit.buy-now"]',
  '.a-button-input[aria-labelledby="buy-now-button-announce"]',
];

// 2. 「カートに入れる」ボタンの直後
const cartSelectors = [
  "#add-to-cart-button",
  'input[name="submit.add-to-cart"]',
];

// 3. 購入エリア内の適切な位置
const buyBoxSelectors = ["#buyBoxInner", "#buyBoxAccordion"];
```

## 🎨 UI デザイン

### Amazon ネイティブスタイル

- Amazon 公式 CSS の完全統合
- `a-button`クラスの正確な再現
- グラデーション、ボーダー、シャドウの完全一致
- フォント（Amazon Ember）の使用

### レスポンシブ対応

- モバイル・タブレット・デスクトップ対応
- Amazon の既存 UI に完全に適合
- スクロールバーやコンテナサイズも Amazon に準拠

### UI テスト

`test-amazon-ui.html` でスタイルのテストが可能：

- Amazon 公式 CSS の読み込みテスト
- 図書館ボタンのスタイルテスト
- Keepa 風詳細表示のテスト

## ⚙️ 設定とカスタマイズ

現在の検索対象図書館を変更したい場合は、`background.js` の以下の部分を編集してください：

```javascript
// 図書館システムのURL
const LIBRARY_BASE_URL = "https://libopac-c.kosen-k.go.jp/webopac12/";
```

Amazon CSS の URL を変更したい場合は、`content.js` の以下の部分を編集：

```javascript
const amazonCSSUrl =
  "https://m.media-amazon.com/images/I/11VHci0R+LL._RC%7C...";
```

## 🔒 プライバシー

- Amazon の書籍情報のみを取得
- 個人情報は収集しません
- 検索履歴は保存しません
- 全ての通信は HTTPS で暗号化
- Amazon 公式 CSS は外部から安全に読み込み

## 🐛 トラブルシューティング

### 拡張機能が表示されない

1. Amazon の書籍ページかどうか確認
2. デベロッパーツールでエラーがないか確認
3. 拡張機能が有効になっているか確認

### ボタンのスタイルが正しくない

1. Amazon 公式 CSS の読み込み状況を確認
2. `test-amazon-ui.html` でスタイルテストを実行
3. コンソールで CSS 読み込みエラーがないか確認

### 検索結果が表示されない

1. ISBN が正しく抽出されているか確認
2. 図書館システムがアクセス可能か確認
3. CORS エラーがないか確認

### デバッグ方法

検索とスタイルのデバッグ情報を確認するには：

```javascript
// Chromeのデベロッパーツールで確認
// 1. Amazon書籍ページでF12を押す
// 2. Consoleタブを開く
// 3. 以下のような情報が表示されます

// CSS読み込み状況
"🎨 指定されたAmazonのネイティブCSSを読み込みました"
"✅ AmazonCSS読み込み完了 - a-buttonスタイルが利用可能"

// 書籍情報抽出
"抽出された書籍情報: {title: '...', author: '...', isbn13: '...'}"

// ボタン配置
"📚 図書館ボタンを「今すぐ買う」ボタン (#buy-now-button) の直後に挿入しました"

// 検索試行履歴
"🔍 戦略1: ISBN検索を試行中..."
"✅ ISBN検索成功" または "⚠️ ISBN検索失敗、フォールバック実行"
```

## 📝 開発

### 元のスクリプトとの関係

この拡張機能は `working_scraper.js` の機能をベースに作成されています：

- 同一の検索ロジック
- 同一の HTML 解析処理
- Chrome 拡張機能として再実装
- Amazon 公式スタイルの完全統合

### 今回の主な改善点

1. **Amazon 公式 CSS 統合**: 指定されたスタイルシートの動的読み込み
2. **ネイティブボタンスタイル**: `a-button`クラスの完全再現
3. **配置戦略改善**: 「今すぐ買う」ボタンの直後への精密配置
4. **デュアル UI**: ボタンと詳細情報の分離配置
5. **UI テストページ**: スタイルテスト用ページの追加

### 更新と改善

- より多くの図書館システムに対応
- 検索精度の向上
- UI/UX の改善
- 設定画面の追加
- 他の Amazon スタイルシート URL への対応

## 📄 ライセンス

MIT License - 自由に使用・改変・配布が可能です。

## 🤝 貢献

プルリクエストやイシューの報告を歓迎します！

---

**注意**: この拡張機能は教育・研究目的で作成されています。Amazon や図書館システムの利用規約を遵守してご利用ください。
