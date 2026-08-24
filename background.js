// バックグラウンドスクリプト - 図書館検索APIの処理
class LibrarySearchService {
  constructor() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    console.log("背景スクリプト: メッセージリスナーを設定中...");

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("🎯 背景スクリプトでメッセージを受信:", request);
      console.log("📝 送信者情報:", sender);

      // 個別の検索アクション
      if (request.action === "searchByISBN") {
        console.log("ISBN検索リクエストを処理中...");
        this.handleSearchByISBN(request, sendResponse);
        return true; // 非同期レスポンスを示す
      }

      if (request.action === "searchByTitle") {
        console.log("タイトル検索リクエストを処理中...");
        this.handleSearchByTitle(request, sendResponse);
        return true; // 非同期レスポンスを示す
      }

      if (request.action === "searchByName") {
        console.log("名前検索リクエストを処理中...");
        this.handleSearchByName(request, sendResponse);
        return true; // 非同期レスポンスを示す
      }

      // 従来の統合検索（後方互換性のため）
      if (request.action === "searchLibrary") {
        console.log("🔍 統合検索リクエストを処理中...");
        console.log("🔍 リクエストの詳細:", JSON.stringify(request, null, 2));
        this.handleLibrarySearch(request, sendResponse);
        return true; // 非同期レスポンスを示す
      }

      console.log("未知のアクション:", request.action);
      return false;
    });
  }

  async handleSearchByISBN(request, sendResponse) {
    try {
      console.log("ISBN検索ハンドラー開始:", request.query);
      const result = await this.searchByISBN(request.query);
      const response = {
        success: true,
        results: result.books || [],
        found: result.found,
        searchMethod: "ISBN",
      };
      console.log("ISBN検索完了、応答送信中:", response);
      sendResponse(response);
    } catch (error) {
      console.error("ISBN検索エラー:", error);
      const errorResponse = {
        success: false,
        error: error.message,
        searchMethod: "ISBN",
      };
      console.log("ISBN検索エラー応答送信中:", errorResponse);
      sendResponse(errorResponse);
    }
  }

  async handleSearchByTitle(request, sendResponse) {
    try {
      console.log("タイトル検索ハンドラー:", request.query);
      const result = await this.searchByKeyword(request.query);
      sendResponse({
        success: true,
        results: result.books || [],
        found: result.found,
        searchMethod: "タイトル",
      });
    } catch (error) {
      console.error("タイトル検索エラー:", error);
      sendResponse({
        success: false,
        error: error.message,
        searchMethod: "タイトル",
      });
    }
  }

  async handleSearchByName(request, sendResponse) {
    try {
      console.log("名前検索ハンドラー:", request.query);
      const result = await this.searchByKeyword(request.query);
      sendResponse({
        success: true,
        results: result.books || [],
        found: result.found,
        searchMethod: "名前",
      });
    } catch (error) {
      console.error("名前検索エラー:", error);
      sendResponse({
        success: false,
        error: error.message,
        searchMethod: "名前",
      });
    }
  }

  async handleLibrarySearch(request, sendResponse) {
    console.log("🎯 handleLibrarySearch開始 - リクエスト受信:", request);

    try {
      const { isbn, bookInfo, collegeId = "12" } = request;
      console.log("📚 抽出されたデータ:", { isbn, bookInfo, collegeId });

      let result = null;
      let searchAttempts = [];

      // フォールバック検索戦略
      if (isbn) {
        // 戦略1: ISBN検索
        console.log("🔍 戦略1: ISBN検索を試行中...");
        try {
          result = await this.searchByISBN(isbn, collegeId);
          searchAttempts.push({
            type: "ISBN",
            query: isbn,
            success: result.found,
          });

          if (result.found && result.books.length > 0) {
            console.log("✅ ISBN検索成功");
            result.searchMethod = "ISBN検索";
            await this.enrichWithHoldings(result.books, collegeId);
            console.log("📤 検索成功レスポンスを送信:", result);
            sendResponse(result);
            return;
          }
        } catch (error) {
          console.warn("ISBN検索エラー:", error.message);
          searchAttempts.push({
            type: "ISBN",
            query: isbn,
            success: false,
            error: error.message,
          });
        }
      }

      if (bookInfo.title) {
        // 戦略2: タイトル検索
        console.log("🔍 戦略2: タイトル検索を試行中...");
        try {
          const fullTitleQuery = this.generateFullTitleQuery(bookInfo);
          result = await this.searchByKeyword(fullTitleQuery, collegeId);
          searchAttempts.push({
            type: "タイトル検索",
            query: fullTitleQuery,
            success: result.found,
          });

          if (result.found && result.books.length > 0) {
            console.log("✅ タイトル検索成功");
            result.searchMethod = "タイトル検索";
            await this.enrichWithHoldings(result.books, collegeId);
            console.log("📤 タイトル検索成功レスポンスを送信:", result);
            sendResponse(result);
            return;
          }
        } catch (error) {
          console.warn("タイトル検索エラー:", error.message);
          searchAttempts.push({
            type: "タイトル検索",
            query: fullTitleQuery,
            success: false,
            error: error.message,
          });
        }

        // 戦略3: 名前検索（メインタイトル + 著者）
        console.log("🔍 戦略3: 名前検索を試行中...");
        try {
          const mainTitleQuery = this.generateMainTitleAuthorQuery(bookInfo);
          result = await this.searchByKeyword(mainTitleQuery, collegeId);
          searchAttempts.push({
            type: "名前検索",
            query: mainTitleQuery,
            success: result.found,
          });

          if (result.found && result.books.length > 0) {
            console.log("✅ 名前検索成功");
            result.searchMethod = "名前検索";
            await this.enrichWithHoldings(result.books, collegeId);
            console.log("📤 名前検索成功レスポンスを送信:", result);
            sendResponse(result);
            return;
          }
        } catch (error) {
          console.warn("名前検索エラー:", error.message);
          searchAttempts.push({
            type: "名前検索",
            query: mainTitleQuery,
            success: false,
            error: error.message,
          });
        }
      }

      // 全ての検索戦略が失敗
      console.log("❌ 全ての検索戦略が失敗しました");
      console.log("検索試行履歴:", searchAttempts);

      const failureResponse = {
        found: false,
        books: [],
        searchMethod: "全戦略失敗",
        searchAttempts: searchAttempts,
      };
      console.log("📤 検索失敗レスポンスを送信:", failureResponse);
      sendResponse(failureResponse);
    } catch (error) {
      console.error("🚨 図書館検索エラー:", error);
      const errorResponse = {
        error: error.message,
        found: false,
        books: [],
      };
      console.log("📤 エラーレスポンスを送信:", errorResponse);
      sendResponse(errorResponse);
    }
  }

  async enrichWithHoldings(books, collegeId) {
    // 詳細ページへのリクエストが増えるため、上位数件のみ貸出状況を取得する
    const MAX_HOLDINGS_LOOKUPS = 5;
    const targets = books.filter((book) => book.bibId).slice(0, MAX_HOLDINGS_LOOKUPS);

    await Promise.all(
      targets.map(async (book) => {
        try {
          const holdings = await this.fetchHoldings(book.bibId, collegeId);
          book.holdings = holdings.copies;
        } catch (error) {
          console.warn("📋 貸出状況取得エラー:", book.bibId, error.message);
          book.holdings = null;
        }
      })
    );
  }

  async fetchHoldings(bibId, collegeId = "12") {
    console.log("📋 貸出状況取得:", bibId, "高専ID:", collegeId);

    // 直前の検索と同じセッション（Cookie）で叩く必要がある。
    // セッションが無い状態でcatdbl.doを直接叩くと、所蔵情報が空のテンプレートしか返らない。
    const response = await fetch(
      `https://libopac-c.kosen-k.go.jp/webopac${collegeId}/catdbl.do?bibid=${encodeURIComponent(
        bibId
      )}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Referer: `https://libopac-c.kosen-k.go.jp/webopac${collegeId}/cattab.do`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return this.parseHoldings(html);
  }

  parseHoldings(html) {
    // 所蔵情報テーブルは横型(syozou_yoko)・縦型(syozou_tate)の2つが
    // 同じ内容で並んでいることがあるため、最初の1つだけを対象にする
    const tableMatch = html.match(
      /<div class="opac_booksyozou_area[^"]*">\s*<table>([\s\S]*?)<\/table>/
    );
    if (!tableMatch) {
      return { copies: [] };
    }

    const rows = [...tableMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
      .map((m) => m[1])
      .filter((row) => !row.includes("<th"));

    // 列の並びは No./巻号/所蔵館/配置場所/請求記号/資料ID/状態/コメント/返却予定日/予約
    const copies = rows.map((row) => {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
        m[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      );

      const [, , library, location, callNumber, itemId, status, , dueDate] =
        cells;

      return {
        library: library || "",
        location: location || "",
        callNumber: callNumber || "",
        itemId: itemId || "",
        onLoan: status === "貸出中",
        dueDate: dueDate || "",
      };
    });

    console.log("📋 貸出状況パース結果:", copies);
    return { copies };
  }

  async searchByISBN(isbn, collegeId = "12") {
    console.log("ISBN検索実行:", isbn, "高専ID:", collegeId);

    const postData = new URLSearchParams({
      isbn_issn: isbn,
      search_mode: "advanced",
      listcnt: "50",
      startpos: "",
      fromDsp: "catsre",
      sortkey: "",
      sorttype: "",
    });

    const response = await fetch(
      `https://libopac-c.kosen-k.go.jp/webopac${collegeId}/ctlsrh.do`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Referer: `https://libopac-c.kosen-k.go.jp/webopac${collegeId}/cattab.do`,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
        },
        body: postData,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return this.parseSearchResults(html);
  }

  async searchByKeyword(keyword, collegeId = "12") {
    console.log("キーワード検索実行:", keyword, "高専ID:", collegeId);

    const postData = new URLSearchParams({
      words: keyword.trim(),
      holar: "12",
      formkeyno: "",
      sortkey: "",
      sorttype: "",
      listcnt: "50",
      startpos: "",
      fromDsp: "catsre",
      srhRevTagFlg: "",
    });

    const response = await fetch(
      `https://libopac-c.kosen-k.go.jp/webopac${collegeId}/ctlsrh.do`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Referer: `https://libopac-c.kosen-k.go.jp/webopac${collegeId}/cattab.do`,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
        },
        body: postData,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return this.parseSearchResults(html);
  }

  generateFullTitleQuery(bookInfo) {
    console.log("タイトル検索クエリ生成:", bookInfo);

    if (!bookInfo.title) {
      throw new Error("タイトルが指定されていません");
    }

    // タイトルをそのまま使用（軽微なクリーニングのみ）
    let query = bookInfo.title.trim();

    // Amazon特有の文言を除去
    query = query.replace(/\s*-\s*Amazon\.co\.jp$/, "");
    query = query.replace(/\s*:\s*本$/, "");
    query = query.replace(/\s*\(Kindle版\)$/, "");
    query = query.replace(/\s*\(単行本\)$/, "");
    query = query.replace(/\s*\(文庫\)$/, "");

    console.log(`✅ タイトル検索クエリ: "${query}"`);
    return query;
  }

  generateMainTitleAuthorQuery(bookInfo) {
    console.log("名前検索クエリ生成:", bookInfo);

    let query = "";

    if (bookInfo.title) {
      // メインタイトルのみを抽出（最初の空白、コロン、ハイフンなどまで）
      let mainTitle = bookInfo.title.trim();

      // Amazon特有の文言を除去
      mainTitle = mainTitle.replace(/\s*-\s*Amazon\.co\.jp$/, "");
      mainTitle = mainTitle.replace(/\s*:\s*本$/, "");
      mainTitle = mainTitle.replace(/\s*\(Kindle版\)$/, "");
      mainTitle = mainTitle.replace(/\s*\(単行本\)$/, "");
      mainTitle = mainTitle.replace(/\s*\(文庫\)$/, "");

      // メインタイトル部分を抽出（最初の区切り文字まで）
      const separators = /[：:―－─\s]/;
      const firstSeparatorIndex = mainTitle.search(separators);

      if (firstSeparatorIndex > 0) {
        mainTitle = mainTitle.substring(0, firstSeparatorIndex).trim();
      }

      // 版数などを除去
      mainTitle = mainTitle.replace(/第?\d+版?/g, "").trim();
      mainTitle = mainTitle.replace(/\([^)]*\)/g, "").trim();
      mainTitle = mainTitle.replace(/【[^】]*】/g, "").trim();

      query += mainTitle;
      console.log(`📖 メインタイトル抽出: "${mainTitle}"`);
    }

    if (bookInfo.author && bookInfo.author.length > 1) {
      // 著者名を処理
      let authorName = bookInfo.author.trim();

      // 不適切な値をフィルタリング
      if (!authorName.match(/^(フォロー|詳細|more|…)$/i)) {
        // 最初の著者名のみを取得（カンマや中点で区切られている場合）
        authorName = authorName.split(/[,、・\s]/)[0].trim();

        // 「著」「編」などの文言を除去
        authorName = authorName.replace(/[著編訳監修監編著共著]$/, "");

        if (authorName && authorName.length > 1) {
          query += ` ${authorName}`;
          console.log(`👤 著者名抽出: "${authorName}"`);
        }
      }
    }

    if (!query.trim()) {
      throw new Error("有効な検索クエリを生成できませんでした");
    }

    console.log(`✅ 名前検索クエリ: "${query.trim()}"`);
    return query.trim();
  }

  parseSearchResults(html) {
    console.log("検索結果解析開始");

    // 最初に書籍詳細ページかどうかをチェック
    const isDetailPage =
      html.includes("書誌詳細") && html.includes("標題および責任表示");

    if (isDetailPage) {
      return this.parseDetailPage(html);
    } else {
      return this.parseSearchResultsPage(html);
    }
  }

  parseDetailPage(html) {
    console.log("書籍詳細ページを解析中");

    // JavaScriptから書誌IDを抽出
    const bibidMatch = html.match(/var\s+bibid\s*=\s*['"]([^'"]+)['"]/);

    // タイトルを抽出
    const titleMatch = html.match(
      /<th[^>]*>\s*標題および責任表示\s*<\/th>\s*<td[^>]*>\s*([^<]+)/
    );

    // 著者を抽出
    const authorMatch = html.match(/\/\s*([^<\/]+)著/);

    if (!bibidMatch) {
      return { found: false, books: [] };
    }

    const book = {
      bibId: bibidMatch[1],
      title: titleMatch ? titleMatch[1].trim() : "",
      author: authorMatch ? authorMatch[1].trim() : "",
      source: "detail_page",
      number: 1,
      displayNumber: 1,
    };

    console.log("詳細ページから抽出:", book);

    return {
      found: true,
      books: [book],
      totalCount: 1,
      extractedCount: 1,
    };
  }

  parseSearchResultsPage(html) {
    console.log("検索結果ページを解析中");

    const books = [];

    // 検索結果の総件数を抽出
    const totalCountMatch = html.match(/全(\d+)件/);
    const totalCount = totalCountMatch ? parseInt(totalCountMatch[1]) : 0;
    console.log(`検索結果総件数: ${totalCount}件`);

    // 隠しフォームから書誌情報を抽出
    const formPattern =
      /<form[^>]*id="orderRSV_Ajax_Form([^"]+)"[^>]*>[\s\S]*?<input[^>]*name="bibbr"[^>]*value="([^"]+)"[^>]*>[\s\S]*?<input[^>]*name="bibid"[^>]*value="([^"]+)"[^>]*>[\s\S]*?<\/form>/g;

    let match;
    let matchCount = 0;
    while ((match = formPattern.exec(html)) !== null) {
      matchCount++;
      const [, formId, fullBibbr, bibId] = match;

      try {
        const book = this.parseFormData(formId, fullBibbr, bibId);
        if (book.title) {
          // 番号を設定（見つかった順序）
          book.number = matchCount;
          book.displayNumber = matchCount;
          books.push(book);
          console.log(`${matchCount}. ${book.title}`);
        }
      } catch (error) {
        console.warn(`フォーム ${formId} の解析でエラー:`, error.message);
      }
    }

    console.log(`検索結果解析完了: ${books.length}件の書籍を抽出`);

    return {
      found: books.length > 0,
      books: books,
      totalCount: totalCount,
      extractedCount: books.length,
    };
  }

  parseFormData(formId, bibbr, bibId) {
    // bibbrから詳細情報を抽出
    const parts = bibbr.split(" / ");
    const title = parts[0] ? parts[0].trim() : "";

    let author = "";
    let publisher = "";
    let year = "";
    let edition = "";
    let series = "";

    if (parts.length > 1) {
      const remaining = parts.slice(1).join(" / ");

      // 著者を抽出（「;」より前の部分のみ）
      const authorMatch = remaining.match(
        /^([^;]+(?:著|編|訳|監修|監|編著|共著))/
      );
      if (authorMatch) {
        author = authorMatch[1].trim();
      }

      // 版情報を抽出
      const editionMatch = remaining.match(/--\s*([^.]*版[^.]*)/);
      if (editionMatch) {
        edition = editionMatch[1].trim();
      }

      // 出版社と出版年を抽出（版情報の後から）
      const pubMatch = remaining.match(
        /--\s*(?:[^.]*版[^.]*\.\s*--\s*)?([^,]+),\s*(\d{4})/
      );
      if (pubMatch) {
        publisher = pubMatch[1].trim();
        year = pubMatch[2];
      } else {
        // 年なしの出版社情報
        const pubOnlyMatch = remaining.match(
          /--\s*(?:[^.]*版[^.]*\.\s*--\s*)?([^,.-]+)(?:[,.-]|$)/
        );
        if (pubOnlyMatch) {
          publisher = pubOnlyMatch[1].trim();
        }
      }

      // シリーズを抽出
      const seriesMatch = remaining.match(/--\s*\(([^)]+)\)/);
      if (seriesMatch) {
        series = seriesMatch[1].trim();
      }
    }

    return {
      bibId,
      formId,
      title,
      author,
      publisher,
      year,
      edition,
      series,
      fullBibbr: bibbr,
    };
  }
}

// バックグラウンドサービスを初期化
console.log("背景スクリプト: サービスワーカー初期化中...");
const libraryService = new LibrarySearchService();
console.log("背景スクリプト: 初期化完了");
