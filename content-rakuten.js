// 楽天市場書籍ページ用コンテンツスクリプト
class RakutenLibraryFinder {
  constructor() {
    this.buttonContainer = null;
    this.detailsContainer = null;
    this.bookInfo = null;
    this.collegeId = "12"; // デフォルトは茨城工業高等専門学校
    this.insertAfterCart = false; // カートボタンの後に挿入するかのフラグ
    this.init();
  }

  init() {
    console.log("🚀 RakutenLibraryFinder初期化開始");
    if (document.querySelector(".library-finder-button")) {
      return;
    }
    if (!this.isBookPage()) {
      return;
    }

    // 保存された高専IDを読み込み
    this.loadCollegeId().then(() => {
      this.applyRakutenButtonStyles();
      this.extractBookInfo();
      this.createAndInsertUI();
      if (this.bookInfo && (this.bookInfo.isbn || this.bookInfo.title)) {
        this.searchLibrary();
      } else {
        this.displayError("書籍情報の取得に失敗しました");
      }
    });
  }

  async loadCollegeId() {
    try {
      const result = await chrome.storage.sync.get(["selectedCollegeId"]);
      if (result.selectedCollegeId) {
        this.collegeId = result.selectedCollegeId;
        console.log("💾 保存された高専ID読み込み:", this.collegeId);
      } else {
        console.log("💾 デフォルト高専ID使用:", this.collegeId);
      }
    } catch (error) {
      console.error("💾 高専ID読み込みエラー:", error);
    }
  }

  updateCollegeId(newCollegeId) {
    console.log("🔄 高専ID更新:", this.collegeId, "->", newCollegeId);
    this.collegeId = newCollegeId;

    // 既に検索結果が表示されている場合は再検索
    if (this.bookInfo && (this.bookInfo.isbn || this.bookInfo.title)) {
      console.log("🔄 設定変更により再検索を実行");
      this.searchLibrary();
    }
  }

  applyRakutenButtonStyles() {
    const styleId = "library-finder-rakuten-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      /* 楽天風ボタンの実装 */
      .library-finder-button {
        position: relative;
        display: inline-block;
        width: 100%;
        text-decoration: none;
        margin: 8px 0;
        border: none;
        border-radius: 4px;
        font-size: 16px;
        font-family: "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
        font-weight: bold;
        text-align: center;
        box-sizing: border-box;
        overflow: hidden;
        cursor: pointer;
        min-height: 44px;
        line-height: 44px;
      }
      
      .library-finder-button-inner {
        position: relative;
        display: block;
        color: inherit;
        text-decoration: none;
        padding: 0 16px;
        border-radius: inherit;
        min-height: inherit;
        line-height: inherit;
        background: inherit;
      }
      
      .library-finder-button-text {
        display: inline-block;
        font-weight: inherit;
        color: inherit;
      }
      
      /* 青いボタン内のテキストは確実に白色にする */
      .library-finder-primary-style .library-finder-button-text {
        color: #ffffff !important;
      }
      
      /* 楽天の図書館ボタンスタイル（青系） */
      .library-finder-primary-style {
        background: #0073e6;
        color: #ffffff !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        border: 1px solid #005cbf;
      }
      
      .library-finder-primary-style * {
        color: #ffffff !important;
      }
      
      .library-finder-primary-style:hover {
        background: #3399ff;
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
        transform: translateY(-1px);
        transition: all 0.2s ease;
        color: #ffffff !important;
      }
      
      .library-finder-primary-style:hover * {
        color: #ffffff !important;
      }
      
      .library-finder-primary-style:active {
        background: #004a9a;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1) inset;
        transform: translateY(0);
        color: #ffffff !important;
      }
      
      .library-finder-primary-style:active * {
        color: #ffffff !important;
      }
      
      /* 無効/検索中スタイル */
      .library-finder-disabled {
        background: #f0f0f0;
        color: #999;
        border: 1px solid #ddd;
        cursor: not-allowed;
        box-shadow: none;
      }
      
      .library-finder-disabled:hover,
      .library-finder-disabled:active {
        background: #f0f0f0;
        transform: none;
        box-shadow: none;
      }
      
      /* 詳細セクション */
      .library-finder-details-section {
        border: 1px solid #e0e0e0; 
        border-radius: 6px; 
        margin: 15px 0;
        overflow: hidden;
        background: #fafafa;
        box-shadow: 0 2px 4px rgba(0,0,0,0.08);
      }
      
      #library-finder-collapsible-header {
        padding: 12px 16px; 
        background: #f5f5f5; 
        border-bottom: 1px solid #e0e0e0; 
        cursor: pointer; 
        font-weight: bold;
        color: #333;
        transition: background 0.2s ease;
        position: relative;
      }
      
      #library-finder-collapsible-header:hover {
        background: #eeeeee;
      }
      
      #library-finder-collapsible-header:after {
        content: "▼";
        position: absolute;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 12px;
        color: #666;
      }
      
      #library-finder-collapsible-content {
        padding: 16px; 
        background-color: #fff; 
        display: block;
      }
      
      .library-finder-result-item {
        background: #ffffff; 
        padding: 16px; 
        border-radius: 4px; 
        margin-bottom: 12px;
        border-left: 4px solid #0073e6;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
      
      .library-finder-result-item h4 {
        margin: 0 0 8px 0;
        color: #333;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .library-finder-result-item p {
        margin: 4px 0;
        font-size: 12px;
        color: #666;
        line-height: 1.3;
      }
      
      .library-finder-result-item a {
        color: #0073e6;
        text-decoration: none;
        font-size: 12px;
        font-weight: bold;
      }
      
      .library-finder-result-item a:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }

  isBookPage() {
    // 楽天ブックスの書籍詳細ページかどうかをチェック
    const isRakutenBooks = window.location.hostname === "books.rakuten.co.jp";
    const hasItemPage = window.location.pathname.includes("/rb/");
    const hasTitle =
      document.querySelector("h1, [data-testid='title']") ||
      document.querySelector("title")?.textContent.includes("楽天ブックス");

    console.log("📚 楽天書籍ページチェック:", {
      isRakutenBooks,
      hasItemPage,
      hasTitle,
      url: window.location.href,
    });

    return isRakutenBooks && hasItemPage && hasTitle;
  }

  extractBookInfo() {
    console.log("📖 楽天書籍情報抽出開始");
    this.bookInfo = { title: null, author: null, isbn: null };

    // タイトル抽出（楽天の実際の構造に基づく）
    let titleText = "";

    // 戦略1: h1[itemprop="name"]から抽出（楽天ブックスの実際の構造）
    const titleElement = document.querySelector('h1[itemprop="name"]');
    if (titleElement) {
      // h1要素の直接のテキストノードのみを取得（著者リストを除外）
      const childNodes = Array.from(titleElement.childNodes);
      for (const node of childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent.trim();
          if (text) {
            titleText = text;
            console.log("📖 h1[itemprop='name']からタイトル抽出:", titleText);
            break;
          }
        }
      }
    }

    // 戦略2: ページタイトルから抽出
    if (!titleText) {
      const pageTitle = document.title;
      if (pageTitle && !pageTitle.includes("楽天ブックス")) {
        titleText = pageTitle.trim();
        console.log("📖 ページタイトルからタイトル抽出:", titleText);
      } else if (pageTitle && pageTitle.includes("-")) {
        titleText = pageTitle.split("-")[0].trim();
        console.log("📖 ページタイトル（分割）からタイトル抽出:", titleText);
      }
    }

    // 戦略3: 通常のh1タグから抽出
    if (!titleText) {
      const titleEl = document.querySelector("h1");
      if (titleEl && titleEl.textContent.trim()) {
        // h1の中から著者リスト部分を除外してタイトルのみ取得
        const fullText = titleEl.textContent.trim();
        const authorListElement = titleEl.querySelector(".authorLink");
        if (authorListElement) {
          titleText = fullText
            .replace(authorListElement.textContent, "")
            .trim();
        } else {
          titleText = fullText;
        }
        console.log("📖 h1からタイトル抽出:", titleText);
      }
    }

    // 戦略4: メタタグから抽出
    if (!titleText) {
      const metaTitle = document.querySelector('meta[property="og:title"]');
      if (metaTitle && metaTitle.content) {
        titleText = metaTitle.content.trim();
        console.log("📖 メタタグからタイトル抽出:", titleText);
      }
    }

    this.bookInfo.title = titleText;

    // 著者抽出（楽天の実際の構造に基づく）
    // 戦略1: .authorLink内のリンクから抽出
    const authorLinks = document.querySelectorAll(
      '.authorLink a[href*="/author/"]'
    );
    if (authorLinks.length > 0) {
      // 全ての著者名を取得して結合
      const authors = Array.from(authorLinks).map((link) =>
        link.textContent.trim()
      );
      this.bookInfo.author = authors.join(", ");
      console.log("📖 著者リンクから著者抽出成功:", this.bookInfo.author);
    } else {
      // 戦略2: 一般的な著者リンクから抽出
      const generalAuthorLinks = document.querySelectorAll(
        "a[href*='/author/']"
      );
      if (generalAuthorLinks.length > 0) {
        this.bookInfo.author = generalAuthorLinks[0].textContent.trim();
        console.log("📖 一般著者リンクから著者抽出:", this.bookInfo.author);
      } else {
        // 戦略3: テキストパターンマッチング
        const authorText = document.body.textContent.match(
          /著者／編集[：:]\s*([^（\n]+)/
        );
        if (authorText) {
          this.bookInfo.author = authorText[1].trim();
          console.log("📖 パターンマッチで著者抽出:", this.bookInfo.author);
        }
      }
    }

    // ISBN抽出
    this.extractISBN();
    console.log("📖 楽天最終的な書籍情報:", this.bookInfo);
  }

  extractISBN() {
    console.log("📖 楽天ISBN抽出開始");

    // 楽天の商品情報セクションからISBNを抽出
    const pageText = document.body.textContent || "";
    console.log("📖 楽天ページテキストの長さ:", pageText.length);

    // 楽天ブックスの実際の表示パターンに基づいたISBN抽出
    const isbnPatterns = [
      // 楽天ブックスの実際の表示パターン：「ISBN：9784274224478」
      /ISBN[：:\s]*(\d{13})/gi,
      /ISBN[：:\s]*(978\d{10})/gi,
      // ハイフンありのパターン
      /ISBN[：:\s]*(978-\d{1}-\d{3}-\d{5}-\d{1})/gi,
      // 10桁ISBN
      /ISBN[：:\s]*(\d{10})/gi,
      // ハイフンなしの13桁を直接検索
      /(978\d{10})/g,
      // より一般的なパターン
      /(\d{13})/g,
    ];

    // 各パターンを試行してISBNを抽出
    for (let i = 0; i < isbnPatterns.length; i++) {
      const pattern = isbnPatterns[i];
      console.log(
        `📖 パターン ${i + 1}/${isbnPatterns.length} を試行:`,
        pattern
      );

      const matches = pageText.match(pattern);
      if (matches) {
        console.log(
          `📖 マッチ発見 (${matches.length}件):`,
          matches.slice(0, 5)
        ); // 最初の5件のみ表示

        for (const match of matches) {
          let isbn = match.replace(/[^0-9X]/gi, ""); // 数字とXのみ残す

          // 13桁または10桁の妥当性チェック
          if (isbn.length === 13 && /^978\d{10}$/.test(isbn)) {
            this.bookInfo.isbn = isbn;
            console.log("📖 楽天ISBN-13抽出成功:", isbn);
            return;
          } else if (isbn.length === 10 && /^\d{9}[\dX]$/i.test(isbn)) {
            this.bookInfo.isbn = isbn;
            console.log("📖 楽天ISBN-10抽出成功:", isbn);
            return;
          }
        }
      }
    }

    console.log("📖 楽天ISBNが見つかりませんでした");
  }

  createAndInsertUI() {
    // メインボタン（カートボタンエリア内）
    this.buttonContainer = document.createElement("div");
    this.buttonContainer.className = "library-finder-button-container";
    this.buttonContainer.innerHTML = `
      <button class="library-finder-button rakuten-style" id="library-finder-search-btn">
        図書館で借りる
      </button>
    `;

    // 楽天ブックス専用のスタイルを追加
    this.addRakutenStyles();

    // 詳細情報コンテナ
    this.detailsContainer = document.createElement("div");
    this.detailsContainer.className = "library-finder-details-section";
    this.detailsContainer.innerHTML = this.getDetailsHTML();

    // ボタンクリックイベントを設定
    this.buttonContainer
      .querySelector("#library-finder-search-btn")
      .addEventListener("click", () => {
        this.searchLibrary();
      });

    this.insertUI();
  }

  addRakutenStyles() {
    // 楽天ブックス専用のスタイルを追加
    if (document.getElementById("rakuten-library-finder-styles")) {
      return; // 既に追加済み
    }

    const style = document.createElement("style");
    style.id = "rakuten-library-finder-styles";
    style.textContent = `
      .library-finder-button-container {
        margin: 6px 0;
        text-align: center;
      }
      
      .library-finder-button.rakuten-style {
        background: #e60012;
        color: #ffffff !important;
        border: none;
        padding: 12px 24px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        width: 100%;
        max-width: 200px;
      }
      
      .library-finder-button.rakuten-style:hover {
        background: #ff3333;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      
      .library-finder-details-section {
        margin-top: 15px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #f9f9f9;
      }
    `;
    document.head.appendChild(style);
  }

  insertUI() {
    console.log("📍 楽天UI挿入開始");

    // 楽天ブックスの実際の構造に基づいてボタンの挿入位置を決定
    let insertionPoint = null;

    // 戦略1: 楽天の購入ボックス内のカートボタンの後を探す
    const purchaseBox = document.querySelector(".purchaseBoxMain");
    const newBuyButton = document.querySelector(".new_buyButton");

    if (purchaseBox && newBuyButton) {
      console.log("📍 .purchaseBoxMain と .new_buyButton を発見");
      insertionPoint = purchaseBox;
      // カートボタンの直後に挿入するため、特別なマーク
      this.insertAfterCart = true;
    } else {
      console.log("📍 楽天の購入ボックスが見つからない、他の戦略を試行");

      // 戦略2: 一般的なカートボタンを探す
      const cartButtonSelectors = [
        "input[value*='買い物かご']",
        "input[value*='カート']",
        "button[type='submit']",
        ".cart-button",
        "#cart-button",
        "form[action*='cart'] input[type='submit']",
      ];

      for (const selector of cartButtonSelectors) {
        const cartButton = document.querySelector(selector);
        if (cartButton) {
          console.log("📍 カートボタン発見:", selector);
          insertionPoint = cartButton.parentElement;
          break;
        }
      }
    }

    // 戦略3: 価格情報の近くを探す
    if (!insertionPoint) {
      const priceSelectors = [
        ".price",
        "[class*='price']",
        "[id*='price']",
        "span:contains('円')",
        "div:contains('税込')",
      ];

      for (const selector of priceSelectors) {
        const priceElement = document.querySelector(selector);
        if (priceElement && priceElement.textContent.includes("円")) {
          console.log("📍 価格要素発見:", selector);
          insertionPoint = priceElement.parentElement;
          break;
        }
      }
    }

    // 戦略3: 在庫状況の近くを探す
    if (!insertionPoint) {
      const stockText = Array.from(document.querySelectorAll("*")).find(
        (el) => el.textContent && el.textContent.includes("在庫あり")
      );
      if (stockText) {
        console.log("📍 在庫情報発見");
        insertionPoint = stockText.parentElement;
      }
    }

    // 戦略4: 商品情報エリアを探す
    if (!insertionPoint) {
      const infoSelectors = [
        ".item-info",
        ".book-info",
        ".product-info",
        "[class*='info']",
        "main",
        ".content",
      ];

      for (const selector of infoSelectors) {
        const infoElement = document.querySelector(selector);
        if (infoElement) {
          console.log("📍 商品情報エリア発見:", selector);
          insertionPoint = infoElement;
          break;
        }
      }
    }

    // ボタンを挿入
    if (insertionPoint) {
      console.log(
        "📍 楽天ボタン挿入先確定:",
        insertionPoint.tagName,
        insertionPoint.className
      );

      // 特別なケース: .new_buyButton の後に挿入
      if (this.insertAfterCart && newBuyButton) {
        console.log("📍 カートボタンの後に図書館ボタンを挿入");
        newBuyButton.parentNode.insertBefore(
          this.buttonContainer,
          newBuyButton.nextSibling
        );
      } else {
        insertionPoint.appendChild(this.buttonContainer);
      }
    } else {
      console.log("📍 楽天フォールバック：body に挿入");
      document.body.appendChild(this.buttonContainer);
    }

    // 詳細情報の挿入位置を決定
    let detailsInsertionPoint = null;

    // 最優先: .benefitSection の下に配置
    const benefitSection = document.querySelector(".benefitSection");
    if (benefitSection) {
      console.log("📍 .benefitSection要素を発見、その下に詳細情報を配置");
      // .benefitSectionの直後に挿入
      benefitSection.parentNode.insertBefore(
        this.detailsContainer,
        benefitSection.nextSibling
      );
    } else {
      // フォールバック: .linkOtherFormat の下に配置
      const linkOtherFormat = document.querySelector(".linkOtherFormat");
      if (linkOtherFormat) {
        console.log("📍 .linkOtherFormat要素を発見、その下に詳細情報を配置");
        // .linkOtherFormatの直後に挿入
        linkOtherFormat.parentNode.insertBefore(
          this.detailsContainer,
          linkOtherFormat.nextSibling
        );
      } else {
        // さらなるフォールバック: 商品説明やレビューの近くを探す
        const descriptionSelectors = [
          ".description",
          ".content",
          "[class*='description']",
          "[class*='review']",
          ".item-detail",
          ".book-detail",
        ];

        for (const selector of descriptionSelectors) {
          const descElement = document.querySelector(selector);
          if (descElement) {
            console.log("📍 詳細情報挿入先発見:", selector);
            detailsInsertionPoint = descElement;
            break;
          }
        }

        if (detailsInsertionPoint) {
          detailsInsertionPoint.appendChild(this.detailsContainer);
        } else {
          // 最後のフォールバック: ボタンの後に配置
          this.buttonContainer.parentNode.insertBefore(
            this.detailsContainer,
            this.buttonContainer.nextSibling
          );
        }
      }
    }

    console.log("📍 楽天UI挿入完了");
  }

  getDetailsHTML() {
    return `
      <div id="library-finder-collapsible-header">図書館での蔵書状況</div>
      <div id="library-finder-collapsible-content"></div>
    `;
  }

  async searchLibrary() {
    console.log("🔍 楽天図書館検索開始");
    console.log("🔍 検索対象書籍情報:", this.bookInfo);
    console.log("🔍 使用する高専ID:", this.collegeId);

    this.displaySearchingButton();
    try {
      const message = {
        action: "searchLibrary",
        isbn: this.bookInfo.isbn,
        bookInfo: this.bookInfo,
        collegeId: this.collegeId,
      };
      console.log("🔍 Chrome拡張機能にメッセージ送信:", message);

      const response = await chrome.runtime.sendMessage(message);
      console.log("🔍 Chrome拡張機能からのレスポンス:", response);

      if (response && response.found && response.books.length > 0) {
        console.log("✅ 図書館で書籍が見つかりました");
        this.displayResults(response.books);
      } else {
        console.log("❌ 図書館で書籍が見つかりませんでした");
        this.displayNoResults();
      }
    } catch (error) {
      console.error("💥 図書館検索でエラー発生:", error);
      console.error("💥 エラーの詳細:", error.message);
      this.displayError(error.message);
    }
  }

  displaySearchingButton() {
    const searchingHTML = `
      <div class="library-finder-button library-finder-disabled">
        <span class="library-finder-button-inner">
          <span class="library-finder-button-text">図書館を検索中...</span>
        </span>
      </div>
    `;
    this.buttonContainer.innerHTML = searchingHTML;
  }

  displayResults(books) {
    console.log("📚 楽天図書館検索結果を表示:", books);
    console.log("📚 検索結果数:", books.length);
    console.log("📚 使用中の高専ID:", this.collegeId);

    if (books.length > 0) {
      console.log("📚 最初の書籍データ:", books[0]);
      console.log("📚 書籍ID (id):", books[0].id);
      console.log("📚 書籍ID (bibId):", books[0].bibId);
      console.log("📚 書籍URL:", books[0].url);
    }

    let bookUrl;
    // bibIdまたはidプロパティをチェック
    const bookId = books[0].bibId || books[0].id;
    if (bookId && bookId.startsWith("BB")) {
      bookUrl = `https://libopac-c.kosen-k.go.jp/webopac${this.collegeId}/${bookId}`;
      console.log("📚 BBIDを使用したURL生成:", bookUrl);
      console.log("📚 使用したID:", bookId);
      console.log("📚 使用した高専ID:", this.collegeId);
    } else if (books[0].url && books[0].url !== "undefined") {
      bookUrl = books[0].url;
      console.log("📚 元のURLを使用:", bookUrl);
    } else {
      bookUrl = `https://libopac-c.kosen-k.go.jp/webopac${this.collegeId}/`;
      console.log("📚 フォールバックURLを使用:", bookUrl);
    }

    const resultHTML = `
      <a href="${bookUrl}" target="_blank" class="library-finder-button library-finder-primary-style">
        <span class="library-finder-button-inner">
          <span class="library-finder-button-text">図書館で借りる</span>
        </span>
      </a>
    `;
    this.buttonContainer.innerHTML = resultHTML;

    const detailsContent = this.detailsContainer.querySelector(
      "#library-finder-collapsible-content"
    );
    detailsContent.innerHTML = books
      .map((book) => this.getResultHTML(book))
      .join("");
    this.detailsContainer.style.display = "block";

    const header = this.detailsContainer.querySelector(
      "#library-finder-collapsible-header"
    );
    header.addEventListener("click", () => {
      detailsContent.style.display =
        detailsContent.style.display === "none" ? "block" : "none";
    });
  }

  displayNoResults() {
    const noResultHTML = `
      <div class="library-finder-button library-finder-disabled">
        <span class="library-finder-button-inner">
          <span class="library-finder-button-text">図書館にはありません</span>
        </span>
      </div>
    `;
    this.buttonContainer.innerHTML = noResultHTML;

    // 詳細セクションを非表示にする
    this.detailsContainer.style.display = "none";
  }

  displayError(message) {
    const errorHTML = `
      <div class="library-finder-button library-finder-disabled">
        <span class="library-finder-button-inner">
          <span class="library-finder-button-text" style="color: #e74c3c;">${message}</span>
        </span>
      </div>
    `;
    this.buttonContainer.innerHTML = errorHTML;

    // 詳細セクションを非表示にする
    this.detailsContainer.style.display = "none";
  }

  getResultHTML(book) {
    console.log("📚 詳細表示用書籍データ:", book);

    let bookUrl;
    // bibIdまたはidプロパティをチェック
    const bookId = book.bibId || book.id;
    console.log("📚 使用する書籍ID:", bookId);
    console.log("📚 使用する高専ID:", this.collegeId);

    if (bookId && bookId.startsWith("BB")) {
      bookUrl = `https://libopac-c.kosen-k.go.jp/webopac${this.collegeId}/${bookId}`;
      console.log("📚 詳細リンク用BBID URL生成:", bookUrl);
    } else if (book.url && book.url !== "undefined") {
      bookUrl = book.url;
      console.log("📚 詳細リンク用元URL使用:", bookUrl);
    } else {
      bookUrl = `https://libopac-c.kosen-k.go.jp/webopac${this.collegeId}/`;
      console.log("📚 詳細リンク用フォールバックURL使用:", bookUrl);
    }

    return `
      <div class="library-finder-result-item">
        <h4>${book.title}</h4>
        <p><strong>著者:</strong> ${book.author || "不明"}</p>
        <p><strong>出版:</strong> ${book.publisher || "不明"} (${
      book.year || "不明"
    })</p>
        <a href="${bookUrl}" target="_blank">詳細を見る</a>
      </div>
    `;
  }

  updateStatus(message, type) {}
}

// RakutenLibraryFinderインスタンスをグローバルに保持
let rakutenLibraryFinderInstance = null;

// ページ読み込み時にRakutenLibraryFinderを初期化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    rakutenLibraryFinderInstance = new RakutenLibraryFinder();
  });
} else {
  rakutenLibraryFinderInstance = new RakutenLibraryFinder();
}

// ポップアップからの設定更新メッセージを受信するグローバルリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 楽天グローバルメッセージリスナーでメッセージ受信:", message);

  if (message.action === "updateCollegeId" && rakutenLibraryFinderInstance) {
    console.log("🔄 楽天高専ID更新メッセージを処理:", message.collegeId);
    rakutenLibraryFinderInstance.updateCollegeId(message.collegeId);
    sendResponse({ success: true });
  }

  return true; // 非同期レスポンスを許可
});
