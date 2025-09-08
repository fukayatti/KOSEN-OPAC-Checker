// コンテンツスクリプト - Amazonページに図書館情報を埋め込み
class LibraryFinder {
  constructor() {
    this.buttonContainer = null;
    this.detailsContainer = null;
    this.bookInfo = null;
    this.collegeId = "12"; // デフォルトは茨城工業高等専門学校
    this.init();
  }

  init() {
    console.log("🚀 LibraryFinder初期化開始");
    if (document.querySelector(".library-finder-button")) {
      return;
    }
    if (!this.isBookPage()) {
      return;
    }

    // 保存された高専IDを読み込み
    this.loadCollegeId().then(() => {
      this.applyAmazonButtonStyles();
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

  applyAmazonButtonStyles() {
    const styleId = "library-finder-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      /* Amazon風ボタンの完全再現 */
      .library-finder-button {
      position: relative;
      display: inline-block;
      vertical-align: middle;
      text-decoration: none;
      color: #000000ff;
      overflow: hidden;
      cursor: pointer;
      border: 1px solid;
      border-radius: 20px;
      font-size: 14px;
      font-family: "Amazon Ember", Arial, sans-serif;
      font-weight: normal;
      text-align: center;
      box-sizing: border-box;
      width: 100%;
      margin: 0 0 7px 0;
      outline: 0;
      min-width: 0;
      line-height: 1;
      background: transparent;
      }
      
      .library-finder-button-inner {
      position: relative;
      display: block;
      padding: 7px 16px;
      border-radius: 19px;
      border: 0;
      outline: 0;
      color: inherit;
      font: inherit;
      text-decoration: none;
      text-align: center;
      vertical-align: middle;
      cursor: pointer;
      box-sizing: border-box;
      background: inherit;
      line-height: 18px;
      min-height: 27px;
      }
      
      .library-finder-button-text {
        display: inline-block;
        font-weight: 400;
        letter-spacing: 0.02em;
        color: #000000
      }
        /* カートに入れるボタン風（黄色） */
      .library-finder-cart-style {
      border-color: #FCD200;
      background: #f0c14b;
      color: #0F1111;
      box-shadow: 0 2px 5px 0 rgba(213,217,217,.5);
      }
      
      .library-finder-cart-style:hover {
      background: #edb807;
      border-color: #f2cc02;
      }
      
      .library-finder-cart-style:active {
      background: #ddb347;
      box-shadow: 0 1px 3px rgba(0,0,0,.2) inset;
      }
      
      /* 今すぐ買うボタン風（オレンジ） */
      .library-finder-buy-style {
      border-color: #FF9900;
      background: #ff9900;
      color: #FFFFFF;
      box-shadow: 0 2px 5px 0 rgba(213,217,217,.5);
      }
      
      .library-finder-buy-style:hover {
      background: #e88300;
      border-color: #e47911;
      }
      
      .library-finder-buy-style:active {
      background: #d67e00;
      box-shadow: 0 1px 3px rgba(0,0,0,.2) inset;
      }
      
      /* 図書館ボタン風（明るめの青） */
      .library-finder-primary-style {
      border-color: #3498db;
      background: #5dade2;
      color: #000000;
      box-shadow: 0 2px 5px 0 rgba(213,217,217,.5);
      }
      
      .library-finder-primary-style:hover {
      background: #3498db;
      border-color: #2980b9;
      }
      
      .library-finder-primary-style:active {
      background: #2980b9;
      box-shadow: 0 1px 3px rgba(0,0,0,.2) inset;
      }
      
      /* 無効/検索中スタイル */
      .library-finder-disabled {
      border-color: #D5D9D9;
      background: #e9e9e9;
      color: #565959;
      cursor: not-allowed;
      box-shadow: none;
      }
      
      .library-finder-disabled:hover,
      .library-finder-disabled:active {
      background: #e9e9e9;
      border-color: #D5D9D9;
      box-shadow: none;
      }
      
      /* Keepa風詳細セクション */
      .library-finder-details-section {
      border: 1px solid #ddd; 
      border-radius: 8px; 
      margin-top: 15px; 
      margin-bottom: 15px;
      overflow: hidden;
      background: #fafafa;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      #library-finder-collapsible-header {
      padding: 12px 15px; 
      background: #e7e7e7; 
      border-bottom: 1px solid #ddd; 
      cursor: pointer; 
      font-weight: 700;
      color: #333;
      transition: background 0.2s ease;
      }
      #library-finder-collapsible-header:hover {
      background: #d7d7d7;
      }
      #library-finder-collapsible-content {
      padding: 15px; 
      background-color: #fff; 
      display: block;
      }
      .library-finder-result-item {
      background: #ffffff; 
      padding: 15px; 
      border-radius: 4px; 
      margin-bottom: 10px;
      border-left: 4px solid #5dade2;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }
    `;
    document.head.appendChild(style);
  }

  isBookPage() {
    // nav-subnavでdata-category="books"が存在する場合のみ書籍ページとして認識
    const navSubnav = document.querySelector(
      '#nav-subnav[data-category="books"]'
    );
    const hasProductTitle = document.querySelector("#productTitle, h1#title");

    console.log("📚 書籍ページチェック:", {
      navSubnav: !!navSubnav,
      hasProductTitle: !!hasProductTitle,
    });

    return navSubnav && hasProductTitle;
  }

  extractBookInfo() {
    console.log("📖 書籍情報抽出開始");
    this.bookInfo = { title: null, author: null, isbn: null };

    const titleEl = document.querySelector("#productTitle, h1#title");
    if (titleEl) {
      this.bookInfo.title = titleEl.textContent.trim();
      console.log("📖 タイトル抽出:", this.bookInfo.title);
    } else {
      console.log("📖 タイトル要素が見つかりません");
    }

    const authorEl = document.querySelector(
      "#bylineInfo .author .a-link-normal, .author .a-link-normal"
    );
    if (authorEl) {
      this.bookInfo.author = authorEl.textContent.trim();
      console.log("📖 著者抽出:", this.bookInfo.author);
    } else {
      console.log("📖 著者要素が見つかりません");
    }

    // デバッグ: Product Detailsセクションの構造を調査
    console.log("📖 === Product Detailsセクション構造調査 ===");
    const detailsContainers = [
      "#detailBullets_feature_div",
      "#productDetails_feature_div",
      '[data-feature-name="detailBullets"]',
      ".detail-bullet-list",
      "#detail_bullets_id",
    ];

    for (const container of detailsContainers) {
      const element = document.querySelector(container);
      if (element) {
        console.log(`📖 発見: ${container}`);
        console.log(
          "📖 内容プレビュー:",
          element.textContent.substring(0, 300)
        );
        const listItems = element.querySelectorAll(".a-list-item, li");
        console.log(`📖 ${container} 内のリストアイテム数:`, listItems.length);

        listItems.forEach((item, index) => {
          if (index < 5) {
            // 最初の5個だけ表示
            const text = item.textContent.trim();
            if (text.toLowerCase().includes("isbn")) {
              console.log(`📖 ISBN関連テキスト発見 [${index}]:`, text);
            }
          }
        });
      }
    }

    this.extractISBN();
    console.log("📖 最終的な書籍情報:", this.bookInfo);
  }

  extractISBN() {
    console.log("📖 ISBN抽出開始");

    // 優先度1: Product Detailsセクションから直接取得
    const detailsSelectors = [
      // Amazon日本のProduct Detailsセクション
      '[data-feature-name="detailBullets"] .a-list-item',
      "#detailBullets_feature_div .a-list-item",
      "#detail_bullets_id .a-list-item",
      ".detail-bullet-list .a-list-item",
      // より一般的なセレクタ
      '.a-section:contains("Product Details") .a-list-item',
      ".product-details .a-list-item",
    ];

    for (const selector of detailsSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(
          `📖 セレクタ "${selector}" で ${elements.length} 個の要素を発見`
        );

        for (const element of elements) {
          const text = element.textContent || "";
          console.log("📖 要素テキスト:", text.substring(0, 100));

          // ISBN-13を探す
          const isbn13Match = text.match(
            /ISBN-13[\s\u00a0]*[:\u00a0]*[\s\u00a0]*((?:978|979)[\d\-]+)/i
          );
          if (isbn13Match) {
            this.bookInfo.isbn = isbn13Match[1].replace(/-/g, "");
            console.log("📖 ISBN-13抽出成功:", this.bookInfo.isbn);
            console.log("📖 元のISBN文字列:", isbn13Match[1]);
            return;
          }

          // ISBN-10を探す
          const isbn10Match = text.match(
            /ISBN-10[\s\u00a0]*[:\u00a0]*[\s\u00a0]*([\dX\-]+)/i
          );
          if (isbn10Match) {
            this.bookInfo.isbn = isbn10Match[1].replace(/-/g, "");
            console.log("📖 ISBN-10抽出成功:", this.bookInfo.isbn);
            console.log("📖 元のISBN文字列:", isbn10Match[1]);
            return;
          }
        }
      } catch (error) {
        console.log(`📖 セレクタ "${selector}" でエラー:`, error.message);
      }
    }

    // 優先度2: ページ全体のテキストから検索（フォールバック）
    console.log("📖 Product Detailsからの抽出失敗、ページ全体を検索");
    const pageText = document.body.textContent || "";
    console.log("📖 ページテキストの長さ:", pageText.length);

    // より柔軟なパターンで検索
    const patterns = [
      /ISBN-13[\s\u00a0]*[:\u00a0]*[\s\u00a0]*((?:978|979)[\d\-]+)/i,
      /ISBN-10[\s\u00a0]*[:\u00a0]*[\s\u00a0]*([\dX\-]+)/i,
      /ISBN[\s\u00a0]*[:\u00a0]*[\s\u00a0]*((?:978|979)[\d\-]+)/i,
      /ISBN[\s\u00a0]*[:\u00a0]*[\s\u00a0]*([\dX\-]{10,})/i,
    ];

    for (const pattern of patterns) {
      const match = pageText.match(pattern);
      if (match) {
        this.bookInfo.isbn = match[1].replace(/-/g, "");
        console.log("📖 フォールバックISBN抽出成功:", this.bookInfo.isbn);
        console.log("📖 元のISBN文字列:", match[1]);
        console.log("📖 使用パターン:", pattern);
        return;
      }
    }

    // 優先度3: 特定の要素からの直接検索
    const specificSelectors = [
      "#productDetails_detailBullets_sections1",
      "#productDetails_techSpec_section_1",
      '.pdTab[data-feature-name="bookDetails"]',
      '.a-section[data-feature-name="productDetails"]',
    ];

    for (const selector of specificSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent || "";
          console.log(
            `📖 特定要素 "${selector}" テキスト:`,
            text.substring(0, 200)
          );

          const match = text.match(
            /ISBN[-\s]*(?:13|10)?[\s\u00a0]*[:\u00a0]*[\s\u00a0]*((?:978|979)?[\dX\-]+)/i
          );
          if (match) {
            this.bookInfo.isbn = match[1].replace(/-/g, "");
            console.log("📖 特定要素からISBN抽出成功:", this.bookInfo.isbn);
            console.log("📖 元のISBN文字列:", match[1]);
            return;
          }
        }
      } catch (error) {
        console.log(`📖 特定要素 "${selector}" でエラー:`, error.message);
      }
    }

    // 優先度4: URLからISBN抽出（AmazonのASINから）
    console.log("📖 URLからの抽出を試行");
    const url = window.location.href;
    console.log("📖 現在のURL:", url);

    // Amazon日本のURL形式: /dp/ASIN または /gp/product/ASIN
    const asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    if (asinMatch) {
      const asin = asinMatch[1];
      console.log("📖 ASIN発見:", asin);

      // ASINが数字のみで構成されている場合、ISBN-10の可能性
      if (/^\d{10}$/.test(asin)) {
        this.bookInfo.isbn = asin;
        console.log("📖 ASINからISBN-10抽出成功:", this.bookInfo.isbn);
        return;
      }
    }

    // 優先度5: メタデータからの抽出
    console.log("📖 メタデータからの抽出を試行");
    const metaSelectors = [
      'meta[name="isbn"]',
      'meta[property="book:isbn"]',
      'meta[name="book:isbn"]',
      'meta[property="og:isbn"]',
    ];

    for (const selector of metaSelectors) {
      const meta = document.querySelector(selector);
      if (meta) {
        const isbn = meta.getAttribute("content");
        if (isbn) {
          this.bookInfo.isbn = isbn.replace(/-/g, "");
          console.log("📖 メタデータからISBN抽出成功:", this.bookInfo.isbn);
          return;
        }
      }
    }

    console.log("📖 すべての方法でISBNが見つかりませんでした");
  }

  createAndInsertUI() {
    // メインボタン（購入ボタンエリア内）
    this.buttonContainer = document.createElement("div");

    // 詳細情報コンテナ（Keepa風）
    this.detailsContainer = document.createElement("div");
    this.detailsContainer.className = "library-finder-details-section";
    this.detailsContainer.innerHTML = this.getDetailsHTML();

    this.insertUI();
  }

  insertUI() {
    // 購入ボタンエリア（カートに入れる、今すぐ買うボタンがある場所）に配置
    const buyboxInner = document.querySelector(
      "#buyBoxInner, #buybox_feature_div, #buybox"
    );
    const addToCartButton = document.querySelector("#add-to-cart-button");
    const buyNowButton = document.querySelector("#buy-now-button");

    if (buyboxInner && (addToCartButton || buyNowButton)) {
      // カートに入れるボタンの後に配置
      if (addToCartButton) {
        const cartButtonParent = addToCartButton.closest(
          ".a-button-stack, .a-row, .a-section"
        );
        if (cartButtonParent) {
          cartButtonParent.appendChild(this.buttonContainer);
        } else {
          addToCartButton.parentNode.insertBefore(
            this.buttonContainer,
            addToCartButton.nextSibling
          );
        }
      }
      // 今すぐ買うボタンの後にも配置（存在する場合）
      else if (buyNowButton) {
        const buyButtonParent = buyNowButton.closest(
          ".a-button-stack, .a-row, .a-section"
        );
        if (buyButtonParent) {
          buyButtonParent.appendChild(this.buttonContainer);
        } else {
          buyNowButton.parentNode.insertBefore(
            this.buttonContainer,
            buyNowButton.nextSibling
          );
        }
      }
    } else {
      // フォールバック: 右側のカラムに配置
      const rightCol = document.querySelector("#rightCol, #buybox");
      if (rightCol) {
        rightCol.appendChild(this.buttonContainer);
      }
    }

    // Keepa風の詳細情報を商品詳細エリアに配置
    const detailsInsertionPoint = document.querySelector(
      "#bookDescription_feature_div, #detailBullets_feature_div, #feature-bullets, #productDetails_feature_div"
    );
    if (detailsInsertionPoint) {
      detailsInsertionPoint.parentNode.insertBefore(
        this.detailsContainer,
        detailsInsertionPoint.nextSibling
      );
    } else {
      // フォールバック: メインコンテンツエリアに配置
      const mainContent = document.querySelector("#centerCol, #dp-container");
      if (mainContent) {
        mainContent.appendChild(this.detailsContainer);
      }
    }
  }

  getDetailsHTML() {
    return `
      <div id="library-finder-collapsible-header">図書館での蔵書状況</div>
      <div id="library-finder-collapsible-content"></div>
    `;
  }

  async searchLibrary() {
    console.log("🔍 図書館検索開始");
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
    console.log("📚 図書館検索結果を表示:", books);
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
          <span class="library-finder-button-text" style="color: #d13212;">${message}</span>
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
        <h4 style="margin-top:0;">${book.title}</h4>
        <p style="font-size:12px; margin-bottom: 5px;"><strong>著者:</strong> ${
          book.author || "不明"
        }</p>
        <p style="font-size:12px; margin-bottom: 10px;"><strong>出版:</strong> ${
          book.publisher || "不明"
        } (${book.year || "不明"})</p>
        <a href="${bookUrl}" target="_blank">詳細を見る</a>
      </div>
    `;
  }

  updateStatus(message, type) {}
}

// LibraryFinderインスタンスをグローバルに保持
let libraryFinderInstance = null;

// ページ読み込み時にLibraryFinderを初期化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    libraryFinderInstance = new LibraryFinder();
  });
} else {
  libraryFinderInstance = new LibraryFinder();
}

// ポップアップからの設定更新メッセージを受信するグローバルリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 グローバルメッセージリスナーでメッセージ受信:", message);

  if (message.action === "updateCollegeId" && libraryFinderInstance) {
    console.log("🔄 高専ID更新メッセージを処理:", message.collegeId);
    libraryFinderInstance.updateCollegeId(message.collegeId);
    sendResponse({ success: true });
  }

  return true; // 非同期レスポンスを許可
});
