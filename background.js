// バックグラウンドスクリプト - 図書館検索APIの処理
class LibrarySearchService {
  constructor() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'searchLibrary') {
        this.handleLibrarySearch(request, sendResponse);
        return true; // 非同期レスポンスを示す
      }
    });
  }

  async handleLibrarySearch(request, sendResponse) {
    try {
      const { isbn, bookInfo } = request;
      console.log('図書館検索リクエスト:', { isbn, bookInfo });

      let result;
      
      if (isbn) {
        // ISBN検索を優先
        result = await this.searchByISBN(isbn);
      } else if (bookInfo.title) {
        // タイトル+著者でキーワード検索
        result = await this.searchByKeyword(bookInfo);
      } else {
        throw new Error('検索に必要な情報がありません');
      }

      sendResponse(result);
    } catch (error) {
      console.error('図書館検索エラー:', error);
      sendResponse({
        error: error.message,
        found: false,
        books: []
      });
    }
  }

  async searchByISBN(isbn) {
    console.log('ISBN検索実行:', isbn);
    
    const postData = new URLSearchParams({
      isbn_issn: isbn,
      search_mode: 'advanced',
      listcnt: '50',
      startpos: '',
      fromDsp: 'catsre',
      sortkey: '',
      sorttype: ''
    });

    const response = await fetch('https://libopac-c.kosen-k.go.jp/webopac12/ctlsrh.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://libopac-c.kosen-k.go.jp/webopac12/cattab.do',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      },
      body: postData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return this.parseSearchResults(html);
  }

  async searchByKeyword(bookInfo) {
    console.log('キーワード検索実行:', bookInfo);
    
    // キーワード生成
    let keyword = '';
    if (bookInfo.title) {
      // タイトルを正規化
      let title = bookInfo.title;
      title = title.split(/[：:―－]/)[0].trim();
      title = title.replace(/第?\d+版?/g, '').trim();
      title = title.replace(/\([^)]*\)/g, '').trim();
      title = title.replace(/【[^】]*】/g, '').trim();
      keyword += title;
    }

    if (bookInfo.author && bookInfo.author.length > 1) {
      const authorName = bookInfo.author.split(/[,、\s]/)[0].trim();
      if (authorName && authorName.length > 1) {
        keyword += ` ${authorName}`;
      }
    }

    if (!keyword.trim()) {
      throw new Error('検索キーワードを生成できませんでした');
    }

    const postData = new URLSearchParams({
      words: keyword.trim(),
      holar: '12',
      formkeyno: '',
      sortkey: '',
      sorttype: '',
      listcnt: '50',
      startpos: '',
      fromDsp: 'catsre',
      srhRevTagFlg: ''
    });

    const response = await fetch('https://libopac-c.kosen-k.go.jp/webopac12/ctlsrh.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://libopac-c.kosen-k.go.jp/webopac12/cattab.do',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      },
      body: postData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return this.parseSearchResults(html);
  }

  parseSearchResults(html) {
    console.log('検索結果解析開始');
    
    // 最初に書籍詳細ページかどうかをチェック
    const isDetailPage = html.includes('書誌詳細') && html.includes('標題および責任表示');
    
    if (isDetailPage) {
      return this.parseDetailPage(html);
    } else {
      return this.parseSearchResultsPage(html);
    }
  }

  parseDetailPage(html) {
    console.log('書籍詳細ページを解析中');
    
    // JavaScriptから書誌IDを抽出
    const bibidMatch = html.match(/var\s+bibid\s*=\s*['"]([^'"]+)['"]/);
    
    // タイトルを抽出
    const titleMatch = html.match(/<th[^>]*>\s*標題および責任表示\s*<\/th>\s*<td[^>]*>\s*([^<]+)/);
    
    // 著者を抽出
    const authorMatch = html.match(/\/\s*([^<\/]+)著/);

    if (!bibidMatch) {
      return { found: false, books: [] };
    }

    const book = {
      bibId: bibidMatch[1],
      title: titleMatch ? titleMatch[1].trim() : '',
      author: authorMatch ? authorMatch[1].trim() : '',
      source: 'detail_page'
    };

    console.log('詳細ページから抽出:', book);
    
    return {
      found: true,
      books: [book]
    };
  }

  parseSearchResultsPage(html) {
    console.log('検索結果ページを解析中');
    
    const books = [];
    
    // 隠しフォームから書誌情報を抽出
    const formPattern = /<form[^>]*id="orderRSV_Ajax_Form([^"]+)"[^>]*>[\s\S]*?<input[^>]*name="bibbr"[^>]*value="([^"]+)"[^>]*>[\s\S]*?<input[^>]*name="bibid"[^>]*value="([^"]+)"[^>]*>[\s\S]*?<\/form>/g;

    let match;
    while ((match = formPattern.exec(html)) !== null) {
      const [, formId, fullBibbr, bibId] = match;
      
      try {
        const book = this.parseFormData(formId, fullBibbr, bibId);
        if (book.title) {
          books.push(book);
        }
      } catch (error) {
        console.warn(`フォーム ${formId} の解析でエラー:`, error.message);
      }
    }

    console.log(`検索結果: ${books.length}件の書籍を抽出`);
    
    return {
      found: books.length > 0,
      books: books
    };
  }

  parseFormData(formId, bibbr, bibId) {
    // bibbrから詳細情報を抽出
    const parts = bibbr.split(' / ');
    const title = parts[0] ? parts[0].trim() : '';

    let author = '';
    let publisher = '';
    let year = '';

    if (parts.length > 1) {
      const remaining = parts.slice(1).join(' / ');

      // 著者を抽出
      const authorMatch = remaining.match(/^([^;]+(?:著|編|訳|監修|監|編著|共著))/);
      if (authorMatch) {
        author = authorMatch[1].trim();
      }

      // 出版社と出版年を抽出
      const pubMatch = remaining.match(/--\s*(?:[^.]*版[^.]*\.\s*--\s*)?([^,]+),\s*(\d{4})/);
      if (pubMatch) {
        publisher = pubMatch[1].trim();
        year = pubMatch[2];
      }
    }

    return {
      bibId,
      formId,
      title,
      author,
      publisher,
      year,
      fullBibbr: bibbr
    };
  }
}

// バックグラウンドサービスを初期化
new LibrarySearchService();
