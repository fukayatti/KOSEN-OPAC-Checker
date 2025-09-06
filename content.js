// コンテンツスクリプト - Amazonページに図書館情報を埋め込み
class LibraryFinder {
  constructor() {
    this.container = null;
    this.isbn = null;
    this.bookInfo = null;
    this.init();
  }

  init() {
    // Amazonの書籍ページかチェック
    if (!this.isBookPage()) {
      return;
    }

    // ISBN情報を取得
    this.extractBookInfo();
    
    // UIを作成して挿入
    this.createAndInsertUI();
    
    // 図書館検索を実行
    if (this.isbn || this.bookInfo.title) {
      this.searchLibrary();
    }
  }

  isBookPage() {
    // URL パターンチェック
    const url = window.location.href;
    const isBookUrl = url.includes('/dp/') || url.includes('/gp/product/');
    
    if (!isBookUrl) {
      return false;
    }

    // Amazon書籍ページの判定条件
    const indicators = [
      '#productTitle',
      '[data-feature-name="bookDescription"]',
      '#rpi-attribute-book_details-publisher',
      '.a-spacing-small .a-size-base',
      '#detailBulletsWrapper_feature_div',
      '#bookDescription_feature_div',
      '.author',
      '#bylineInfo'
    ];

    const foundIndicators = indicators.filter(selector => document.querySelector(selector));
    console.log(`書籍ページ判定: ${foundIndicators.length}/${indicators.length} 個の指標が見つかりました`);
    
    // 最低2つの指標があれば書籍ページと判定
    return foundIndicators.length >= 2;
  }

  extractBookInfo() {
    this.bookInfo = {
      title: '',
      author: '',
      publisher: '',
      isbn13: '',
      isbn10: ''
    };

    // タイトル抽出
    const titleElement = document.querySelector('#productTitle');
    if (titleElement) {
      this.bookInfo.title = titleElement.textContent.trim();
    }

    // 著者抽出
    const authorElement = document.querySelector('.author .a-link-normal, #bylineInfo .a-link-normal');
    if (authorElement) {
      this.bookInfo.author = authorElement.textContent.trim();
    }

    // ISBN抽出 - 複数のパターンを試行
    this.extractISBN();

    // 最初に見つかったISBNを使用
    this.isbn = this.bookInfo.isbn13 || this.bookInfo.isbn10;
    
    console.log('抽出された書籍情報:', this.bookInfo);
  }

  extractISBN() {
    // ISBN-13のパターン
    const isbn13Patterns = [
      /ISBN-13[^:]*:[^0-9]*(\d{13})/i,
      /ISBN-13[^:]*:[^0-9]*(978[-\s]?\d{1}[-\s]?\d{3}[-\s]?\d{5}[-\s]?\d{1})/i,
      /(978[-\s]?\d{1}[-\s]?\d{3}[-\s]?\d{5}[-\s]?\d{1})/,
      /(978\d{10})/
    ];

    // ISBN-10のパターン
    const isbn10Patterns = [
      /ISBN-10[^:]*:[^0-9]*(\d{10})/i,
      /ISBN-10[^:]*:[^0-9]*(\d{9}[\dX])/i,
      /\/dp\/(\d{10})/,
      /\/dp\/(\d{9}[\dX])/i
    ];

    const pageText = document.documentElement.innerHTML;

    // ISBN-13を優先的に検索
    for (const pattern of isbn13Patterns) {
      const match = pageText.match(pattern);
      if (match) {
        const isbn13 = match[1].replace(/[-\s]/g, '');
        if (isbn13.length === 13 && /^\d{13}$/.test(isbn13)) {
          this.bookInfo.isbn13 = isbn13;
          console.log('ISBN-13抽出成功:', isbn13);
          break;
        }
      }
    }

    // ISBN-13が見つからない場合、ISBN-10を検索
    if (!this.bookInfo.isbn13) {
      for (const pattern of isbn10Patterns) {
        const match = pageText.match(pattern);
        if (match) {
          const isbn10 = match[1].replace(/[-\s]/g, '');
          if (isbn10.length === 10 && /^\d{9}[\dX]$/i.test(isbn10)) {
            this.bookInfo.isbn10 = isbn10;
            console.log('ISBN-10抽出成功:', isbn10);
            break;
          }
        }
      }
    }
  }

  createAndInsertUI() {
    // コンテナ要素を作成
    this.container = document.createElement('div');
    this.container.className = 'library-finder-container amazon-style';
    this.container.innerHTML = this.getInitialHTML();

    // 挿入位置を決定（価格情報の下、Keepaの位置）
    const insertionPoint = this.findInsertionPoint();
    if (insertionPoint) {
      insertionPoint.parentNode.insertBefore(this.container, insertionPoint.nextSibling);
    } else {
      // フォールバック位置
      const fallbackPoint = document.querySelector('#feature-bullets, #productDetails_feature_div, #detailBullets_feature_div');
      if (fallbackPoint) {
        fallbackPoint.parentNode.insertBefore(this.container, fallbackPoint);
      }
    }
  }

  findInsertionPoint() {
    // 価格情報セクションを探す（Keepaと同じような位置）
    const priceSelectors = [
      '#corePrice_feature_div',
      '#apex_desktop', 
      '#rightCol',
      '#buyBoxAccordion',
      '#buybox',
      '#priceblock_ourprice',
      '#priceblock_dealprice'
    ];

    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`挿入位置発見: ${selector}`);
        return element;
      }
    }

    // 書籍特有の要素を探す
    const bookSelectors = [
      '#bookDescription_feature_div',
      '#feature-bullets',
      '#productDetails_feature_div',
      '#detailBullets_feature_div'
    ];

    for (const selector of bookSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`書籍セクション発見: ${selector}`);
        return element;
      }
    }

    return null;
  }

  getInitialHTML() {
    return `
      <div class="library-finder-header">
        <div class="library-finder-icon"></div>
        <h3 class="library-finder-title">📚 図書館で見る</h3>
      </div>
      <div class="library-finder-content">
        <div class="library-finder-status">
          <div class="library-finder-loading">図書館の蔵書を検索中...</div>
        </div>
      </div>
    `;
  }

  async searchLibrary() {
    try {
      console.log('図書館検索開始:', this.isbn || this.bookInfo.title);
      
      // バックグラウンドスクリプトに検索要請を送信
      const response = await chrome.runtime.sendMessage({
        action: 'searchLibrary',
        isbn: this.isbn,
        bookInfo: this.bookInfo
      });

      this.handleSearchResult(response);
    } catch (error) {
      console.error('図書館検索エラー:', error);
      this.showError('図書館の蔵書検索でエラーが発生しました');
    }
  }

  handleSearchResult(result) {
    if (!result || result.error) {
      this.showError(result?.error || '図書館の蔵書検索でエラーが発生しました');
      return;
    }

    if (result.found && result.books && result.books.length > 0) {
      this.showFound(result.books);
    } else {
      this.showNotFound();
    }
  }

  showFound(books) {
    const book = books[0]; // 最初の結果を表示
    const webopacUrl = `https://libopac-c.kosen-k.go.jp/webopac12/BB${book.bibId}`;
    
    this.container.innerHTML = `
      <div class="library-finder-header">
        <div class="library-finder-icon"></div>
        <h3 class="library-finder-title">📚 図書館で見る</h3>
      </div>
      <div class="library-finder-content">
        <div class="library-finder-status">
          <div class="library-finder-found">✅ 図書館にあります！</div>
        </div>
        <a href="${webopacUrl}" target="_blank" class="library-finder-button">
          図書館で確認する
        </a>
      </div>
      <div class="library-finder-details">
        <div class="library-finder-book-info">
          <div class="library-finder-book-title">${this.escapeHtml(book.title)}</div>
          ${book.author ? `<div class="library-finder-book-author">著者: ${this.escapeHtml(book.author)}</div>` : ''}
          <div class="library-finder-book-id">蔵書ID: ${book.bibId}</div>
        </div>
      </div>
    `;
  }

  showNotFound() {
    this.container.innerHTML = `
      <div class="library-finder-header">
        <div class="library-finder-icon"></div>
        <h3 class="library-finder-title">📚 図書館で見る</h3>
      </div>
      <div class="library-finder-content">
        <div class="library-finder-status">
          <div class="library-finder-not-found">❌ 図書館にはありません</div>
        </div>
        <a href="https://libopac-c.kosen-k.go.jp/webopac12/cattab.do" target="_blank" class="library-finder-button">
          図書館で検索する
        </a>
      </div>
      <div class="library-finder-details">
        <div style="color: #666; font-size: 13px;">
          この書籍は図書館の蔵書にありませんが、リクエストできる場合があります。
        </div>
      </div>
    `;
  }

  showError(message) {
    this.container.innerHTML = `
      <div class="library-finder-header">
        <div class="library-finder-icon"></div>
        <h3 class="library-finder-title">📚 図書館で見る</h3>
      </div>
      <div class="library-finder-content">
        <div class="library-finder-status">
          <div class="library-finder-error">⚠️ ${message}</div>
        </div>
        <a href="https://libopac-c.kosen-k.go.jp/webopac12/cattab.do" target="_blank" class="library-finder-button">
          図書館で検索する
        </a>
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ページ読み込み完了後に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new LibraryFinder());
} else {
  new LibraryFinder();
}

// 動的コンテンツの変更を監視（SPAの場合）
let currentUrl = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    // URL変更時に少し遅延してから再実行
    setTimeout(() => new LibraryFinder(), 1000);
  }
}).observe(document.body, { childList: true, subtree: true });
