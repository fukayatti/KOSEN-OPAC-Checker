/**
 * 動作する WebOPAC スクレイパー
 * 実際のHTMLの構造に基づいて設計
 */

const fs = require("fs");

class WorkingOpacScraper {
  constructor() {
    this.books = [];
  }

  scrapeFromFile(filePath) {
    console.log(`ファイルを読み込み中: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`ファイルが見つかりません: ${filePath}`);
    }

    const html = fs.readFileSync(filePath, "utf8");
    return this.scrapeFromHtml(html);
  }

  scrapeFromHtml(html) {
    console.log("スクレイピング開始...");

    // 最初に書籍詳細ページかどうかをチェック
    const detailPageBook = this.extractBookDetailPage(html);
    if (detailPageBook) {
      console.log("✅ 書籍詳細ページから1件の書籍情報を抽出しました");
      return {
        summary: {
          totalCount: 1,
          extractedCount: 1,
        },
        books: [detailPageBook],
      };
    }

    // 検索結果の総件数を抽出
    const totalCountMatch = html.match(/全(\d+)件/);
    const totalCount = totalCountMatch ? parseInt(totalCountMatch[1]) : 0;

    console.log(`検索結果: 全${totalCount}件`);

    // 書籍情報を抽出（複数の方法を試行）
    this.books = this.extractBooksFromMultipleSources(html);

    console.log(`${this.books.length}件の書籍情報を抽出しました`);

    return {
      summary: {
        totalCount,
        extractedCount: this.books.length,
      },
      books: this.books,
    };
  }

  extractBooksFromMultipleSources(html) {
    const books = [];

    // 方法1: 隠しフォームから書誌情報を抽出
    const formBooks = this.extractFromHiddenForms(html);

    // 方法2: テーブル行から直接抽出
    const tableBooks = this.extractFromTableRows(html);

    // 結果をマージ
    const mergedBooks = this.mergeBookData(formBooks, tableBooks);

    return mergedBooks;
  }

  /**
   * 隠しフォームから書誌情報を抽出
   */
  extractFromHiddenForms(html) {
    const books = [];
    const formPattern =
      /<form[^>]*id="orderRSV_Ajax_Form([^"]+)"[^>]*>[\s\S]*?<input[^>]*name="bibbr"[^>]*value="([^"]+)"[^>]*>[\s\S]*?<input[^>]*name="bibid"[^>]*value="([^"]+)"[^>]*>[\s\S]*?<\/form>/g;

    console.log("🔍 フォームパターンでの検索開始...");
    let match;
    let matchCount = 0;
    while ((match = formPattern.exec(html)) !== null) {
      matchCount++;
      const [, formId, fullBibbr, bibId] = match;
      console.log(
        `📋 フォーム ${matchCount} 発見: ID=${formId}, BibID=${bibId}`
      );
      console.log(`📄 BibBr: ${fullBibbr}`);

      try {
        const book = this.parseFormData(formId, fullBibbr, bibId);
        if (book.title) {
          console.log(`✅ 書籍追加: ${book.title}`);
          books.push(book);
        } else {
          console.log(`❌ タイトルが空のため書籍をスキップ`);
        }
      } catch (error) {
        console.warn(`フォーム ${formId} の解析でエラー:`, error.message);
      }
    }

    console.log(
      `🔍 フォーム検索完了: ${matchCount}個のフォームを発見, ${books.length}冊の書籍を抽出`
    );
    return books;
  }

  /**
   * フォームデータを解析
   */
  parseFormData(formId, bibbr, bibId) {
    // bibbrから詳細情報を抽出
    const parts = bibbr.split(" / ");
    const title = parts[0] ? parts[0].trim() : "";

    let author = "";
    let publisher = "";
    let year = "";
    let series = "";
    let edition = "";

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

  /**
   * テーブル行から抽出（番号と追加情報用）
   */
  extractFromTableRows(html) {
    const books = [];

    // bibidのパターンから番号を取得
    const bibidPattern =
      /<th[^>]*opac_list_no_area[^>]*>[\s\S]*?(\d+)<br\/>[^<]*<input[^>]*name="bibid"[^>]*value="([^"]+)"/g;

    let match;
    while ((match = bibidPattern.exec(html)) !== null) {
      const [, number, bibId] = match;
      books.push({
        number: parseInt(number),
        bibId,
        source: "table",
      });
    }

    return books;
  }

  /**
   * 書籍詳細ページから情報を抽出（ISBN検索で詳細ページに直接飛ぶ場合）
   */
  extractBookDetailPage(html) {
    console.log("🔍 書籍詳細ページの検出を試行中...");

    // 書籍詳細ページかどうかを判定
    const isDetailPage =
      html.includes("書誌詳細") && html.includes("標題および責任表示");

    if (!isDetailPage) {
      console.log("❌ 書籍詳細ページではありません");
      return null;
    }

    console.log("✅ 書籍詳細ページを検出しました");

    // JavaScriptから書誌IDとISBNを抽出
    const bibidMatch = html.match(/var\s+bibid\s*=\s*['"]([^'"]+)['"]/);
    const isbnMatch = html.match(/var\s+isbn_issn\s*=\s*['"]([^'"]+)['"]/);

    // タイトルを抽出（標題および責任表示から）
    const titleMatch = html.match(
      /<th[^>]*>\s*標題および責任表示\s*<\/th>\s*<td[^>]*>\s*([^<]+)/
    );

    // 著者を抽出（責任表示から）
    const authorMatch = html.match(/\/\s*([^<\/]+)著/);

    const book = {
      bibId: bibidMatch ? bibidMatch[1] : null,
      isbn: isbnMatch ? isbnMatch[1] : null,
      title: titleMatch ? titleMatch[1].trim() : null,
      author: authorMatch ? authorMatch[1].trim() : null,
      number: 1,
      source: "detail_page",
    };

    console.log("📚 書籍詳細情報を抽出:");
    console.log(`   書誌ID: ${book.bibId}`);
    console.log(`   ISBN: ${book.isbn}`);
    console.log(`   タイトル: ${book.title}`);
    console.log(`   著者: ${book.author}`);

    return book;
  }

  /**
   * フォームデータとテーブルデータをマージ
   */
  mergeBookData(formBooks, tableBooks) {
    const merged = [];

    // bibIdをキーにしてマージ
    const tableMap = new Map();
    tableBooks.forEach((book) => {
      tableMap.set(book.bibId, book);
    });

    formBooks.forEach((formBook, index) => {
      const tableBook = tableMap.get(formBook.bibId);

      const mergedBook = {
        number: tableBook ? tableBook.number : index,
        ...formBook,
        // 追加の表示用情報
        displayNumber: tableBook ? tableBook.number : index + 1,
      };

      merged.push(mergedBook);
    });

    return merged.sort((a, b) => a.number - b.number);
  }

  /**
   * 結果をコンソールに美しく表示
   */
  displayToConsole(result) {
    console.log("\n" + "=".repeat(80));
    console.log("WebOPAC 検索結果");
    console.log("=".repeat(80));

    console.log(`\n統計情報:`);
    console.log(`   総件数: ${result.summary.totalCount.toLocaleString()}件`);
    console.log(`   抽出件数: ${result.summary.extractedCount}件`);

    console.log("\n書籍一覧:");
    console.log("-".repeat(80));

    result.books.forEach((book, index) => {
      console.log(`\n${index + 1}. ${book.title}`);
      console.log(`   ID: ${book.bibId}`);

      if (book.author) {
        console.log(`   著者: ${book.author}`);
      }

      if (book.edition) {
        console.log(`   版: ${book.edition}`);
      }

      if (book.publisher && book.year) {
        console.log(`   出版: ${book.publisher} (${book.year}年)`);
      }

      if (book.series) {
        console.log(`   シリーズ: ${book.series}`);
      }
    });

    console.log("\n" + "=".repeat(80));
  }

  /**
   * 結果をJSONファイルに保存
   */
  saveToJson(result, outputPath) {
    const jsonData = {
      scrapedAt: new Date().toISOString(),
      source: "WebOPAC Search Result",
      summary: result.summary,
      books: result.books,
    };

    fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), "utf8");
    console.log(`JSONファイルに保存しました: ${outputPath}`);
  }

  /**
   * 結果をCSVファイルに保存
   */
  saveToCsv(result, outputPath) {
    const headers = [
      "番号",
      "書誌ID",
      "タイトル",
      "著者",
      "版",
      "出版社",
      "出版年",
      "シリーズ",
    ];

    let csv = headers.join(",") + "\n";

    result.books.forEach((book) => {
      const row = [
        book.displayNumber || book.number || "",
        `"${book.bibId}"`,
        `"${this.escapeCsv(book.title)}"`,
        `"${this.escapeCsv(book.author)}"`,
        `"${this.escapeCsv(book.edition)}"`,
        `"${this.escapeCsv(book.publisher)}"`,
        book.year || "",
        `"${this.escapeCsv(book.series)}"`,
      ];
      csv += row.join(",") + "\n";
    });

    fs.writeFileSync(outputPath, csv, "utf8");
    console.log(`CSVファイルに保存しました: ${outputPath}`);
  }

  escapeCsv(str) {
    if (!str) return "";
    return str.replace(/"/g, '""');
  }
}

// ライブ検索機能を追加
const https = require("https");
const zlib = require("zlib");
const querystring = require("querystring");

/**
 * AmazonのURLから書籍情報を取得
 */
async function getAmazonBookInfo(amazonUrl) {
  console.log(`Amazon書籍情報を取得中: ${amazonUrl}`);

  const url = new URL(amazonUrl);

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
      "Accept-Encoding": "gzip, deflate",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
  };

  return new Promise((resolve, reject) => {
    console.log(`📡 Amazonに接続中...`);
    const req = https.request(options, (res) => {
      console.log(`📡 Amazon応答受信: ${res.statusCode}`);
      let data = [];

      res.on("data", (chunk) => {
        data.push(chunk);
        if (data.length % 100 === 0) {
          console.log(`📡 データ受信中... (${data.length} chunks)`);
        }
      });

      res.on("end", () => {
        console.log(`📡 データ受信完了 (${data.length} chunks)`);
        const buffer = Buffer.concat(data);

        if (res.headers["content-encoding"] === "gzip") {
          console.log(`🗜️  gzip解凍中...`);
          zlib.gunzip(buffer, (err, decompressed) => {
            if (err) {
              reject(new Error(`Amazon解凍エラー: ${err.message}`));
            } else {
              const html = decompressed.toString("utf8");
              console.log(
                `Amazon情報取得完了 (${(html.length / 1024).toFixed(1)}KB取得)`
              );
              resolve(parseAmazonBookInfo(html, amazonUrl));
            }
          });
        } else {
          const html = buffer.toString("utf8");
          console.log(
            `Amazon情報取得完了 (${(html.length / 1024).toFixed(1)}KB取得)`
          );
          resolve(parseAmazonBookInfo(html, amazonUrl));
        }
      });
    });

    req.on("error", (err) => {
      console.log(`❌ Amazon接続エラー: ${err.message}`);
      reject(new Error(`Amazon取得エラー: ${err.message}`));
    });

    req.setTimeout(15000, () => {
      console.log(`⏰ Amazon接続タイムアウト`);
      req.destroy();
      reject(new Error("Amazon取得タイムアウト"));
    });

    req.end();
  });
}

/**
 * AmazonのHTMLから書籍情報を解析
 */
function parseAmazonBookInfo(html, originalUrl) {
  const bookInfo = {
    title: "",
    author: "",
    publisher: "",
    isbn: "",
    isbn13: "",
    isbn10: "",
    originalUrl: originalUrl,
  };

  try {
    // タイトル抽出（より精密なパターン）
    const titlePatterns = [
      /<span[^>]*id="productTitle"[^>]*class="[^"]*"[^>]*>([^<]+)<\/span>/,
      /<span[^>]*id="productTitle"[^>]*>([^<]+)<\/span>/,
      /<h1[^>]*class="[^"]*product[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i,
      /<title>Amazon\.co\.jp:\s*([^|<]+)/,
      /<title>([^<|]+)\s*\|/,
    ];

    for (const pattern of titlePatterns) {
      const titleMatch = html.match(pattern);
      if (titleMatch) {
        let title = decodeHtml(titleMatch[1].trim());
        // Amazon特有の接尾語を除去
        title = title.replace(/\s*-\s*Amazon\.co\.jp$/, "");
        title = title.replace(/\s*:\s*本$/, "");
        bookInfo.title = title;
        console.log(`タイトル抽出成功: "${title}"`);
        break;
      }
    }

    // 著者抽出（より多くのパターン）
    const authorPatterns = [
      // 貢献者セクション
      /<span[^>]*class="[^"]*author[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i,
      /<a[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/a>/i,
      // 書籍詳細セクション
      /<span[^>]*>\s*([^<]+)\s*<\/span>[^<]*\(著\)/,
      /<li[^>]*>\s*<span[^>]*>\s*([^<]+)\s*<\/span>[^<]*著者/,
      // 一般的なパターン
      /著者[：:\s]*<[^>]*>([^<]+)</,
      /by\s+<[^>]*>([^<]+)</i,
      // データ属性から
      /data-author="([^"]+)"/,
      // JSON-LDから
      /"author":\s*"([^"]+)"/,
      /"author":\s*\{"name":\s*"([^"]+)"/,
    ];

    for (const pattern of authorPatterns) {
      const authorMatch = html.match(pattern);
      if (authorMatch) {
        let author = decodeHtml(authorMatch[1].trim());
        // 不適切な値をフィルタリング
        if (
          author &&
          author !== "フォロー" &&
          author.length > 1 &&
          !author.match(/^(詳細|more|…)$/i)
        ) {
          bookInfo.author = author;
          console.log(`著者抽出成功: "${author}"`);
          break;
        }
      }
    }

    // 出版社抽出（より多くのパターン）
    const publisherPatterns = [
      // 書籍詳細セクション
      /<li[^>]*>\s*<span[^>]*>\s*出版社[：:\s]*<\/span>\s*([^<\n]+)/,
      /<span[^>]*>\s*出版社[：:\s]*([^<\n]+)<\/span>/,
      // テーブル形式
      /<th[^>]*>出版社<\/th>\s*<td[^>]*>([^<]+)<\/td>/,
      // 一般的なパターン
      /出版社[：:\s]*([^<\n,；;]+)/,
      /Publisher[：:\s]*([^<\n,；;]+)/i,
      // JSON-LDから
      /"publisher":\s*"([^"]+)"/,
      /"publisher":\s*\{"name":\s*"([^"]+)"/,
    ];

    for (const pattern of publisherPatterns) {
      const publisherMatch = html.match(pattern);
      if (publisherMatch) {
        let publisher = decodeHtml(publisherMatch[1].trim());
        // HTMLエンティティや不要な文字を除去
        publisher = publisher.replace(/&[a-z]+;/gi, "").trim();
        if (publisher && publisher.length > 1) {
          bookInfo.publisher = publisher;
          console.log(`出版社抽出成功: "${publisher}"`);
          break;
        }
      }
    }

    // ISBN抽出（13桁と10桁を分けて抽出）
    const isbn13Patterns = [
      // 最も一般的なAmazonの形式: "ISBN-13 ‏ : ‎ 978-4798179339"
      /ISBN-13[^:]*:\s*‎?\s*(978[-\s]?\d{1}[-\s]?\d{3}[-\s]?\d{5}[-\s]?\d{1})/i,
      // 見えない文字を考慮したパターン
      /ISBN-13[^0-9]*(978[-\s]?\d{1}[-\s]?\d{3}[-\s]?\d{5}[-\s]?\d{1})/i,
      // 基本的なパターン
      /ISBN-13[：:\s]*[‏‎]*[:\s]*[‏‎]*\s*(978[-\s]?\d{1}[-\s]?\d{3}[-\s]?\d{5}[-\s]?\d{1})/i,
      /ISBN-13[：:\s]*[‏‎]*[:\s]*[‏‎]*\s*(\d{13})/i,
      // 978で始まる13桁の数字を直接検索
      /(978[-\s]?\d{1}[-\s]?\d{3}[-\s]?\d{5}[-\s]?\d{1})/i,
      // ハイフンなしバージョン
      /(978\d{10})/i,
      // 書籍詳細セクション
      /<li[^>]*>\s*<span[^>]*>\s*ISBN-13[：:\s]*<\/span>\s*(978[-\s]?\d{1}[-\s]?\d{3}[-\s]?\d{5}[-\s]?\d{1})/i,
      /<li[^>]*>\s*<span[^>]*>\s*ISBN-13[：:\s]*<\/span>\s*(\d{13})/,
      /<span[^>]*>\s*ISBN-13[：:\s]*(978[-\s]?\d{1}[-\s]?\d{3}[-\s]?\d{5}[-\s]?\d{1})<\/span>/i,
      /<span[^>]*>\s*ISBN-13[：:\s]*(\d{13})<\/span>/,
      // テーブル形式
      /<th[^>]*>ISBN-13<\/th>\s*<td[^>]*>(978[-\s]?\d{1}[-\s]?\d{3}[-\s]?\d{5}[-\s]?\d{1})<\/td>/i,
      /<th[^>]*>ISBN-13<\/th>\s*<td[^>]*>(\d{13})<\/td>/,
      // JSON-LDから
      /"isbn":\s*"(978[-\s]?\d{1}[-\s]?\d{3}[-\s]?\d{5}[-\s]?\d{1})"/i,
      /"isbn":\s*"(\d{13})"/,
    ];

    const isbn10Patterns = [
      // Product Details セクションから直接抽出
      /ISBN-10[^:]*:\s*‎?\s*(\d{9}[\dX])/i,
      // 見えない文字を考慮したパターン
      /ISBN-10[^0-9]*(\d{9}[\dX])/i,
      // 基本的なパターン
      /ISBN-10[：:\s]*[‏‎]*[:\s]*[‏‎]*\s*(\d{10})/,
      /ISBN-10[：:\s]*[‏‎]*[:\s]*[‏‎]*\s*(\d{9}[\dX])/i,
      // 書籍詳細セクション
      /<li[^>]*>\s*<span[^>]*>\s*ISBN-10[：:\s]*<\/span>\s*(\d{10})/,
      /<li[^>]*>\s*<span[^>]*>\s*ISBN-10[：:\s]*<\/span>\s*(\d{9}[\dX])/i,
      /<span[^>]*>\s*ISBN-10[：:\s]*(\d{10})<\/span>/,
      /<span[^>]*>\s*ISBN-10[：:\s]*(\d{9}[\dX])<\/span>/i,
      // テーブル形式
      /<th[^>]*>ISBN-10<\/th>\s*<td[^>]*>(\d{10})<\/td>/,
      /<th[^>]*>ISBN-10<\/th>\s*<td[^>]*>(\d{9}[\dX])<\/td>/i,
      // URLのDPから
      /\/dp\/(\d{10})/,
      /\/dp\/(\d{9}[\dX])/i,
    ];

    // ISBN-13を優先的に抽出
    console.log("=====================================");
    console.log("📚 ISBN-13を検索中...");
    console.log("HTMLデータサイズ:", (html.length / 1024).toFixed(1), "KB");

    // HTMLの一部を表示（ISBNが含まれる可能性のある部分）
    const isbnContext = html.match(
      /ISBN[-\s]*1[0-3][^0-9]{0,50}[\d-\s]{10,20}/gi
    );
    if (isbnContext) {
      console.log("📖 ISBN関連コンテキスト発見:");
      isbnContext.forEach((context, i) => {
        console.log(`  [${i + 1}] ${context.substring(0, 100)}...`);
      });
    } else {
      console.log("⚠️ ISBN関連コンテキストが見つかりません");
    }

    // Amazon HTMLからISBN-13関連のテキストを詳細に抽出してデバッグ
    const isbn13DebugMatches = html.match(/ISBN-13[^0-9]{0,20}978\d{10}/gi);
    if (isbn13DebugMatches) {
      console.log("🔍 ISBN-13デバッグマッチ:", isbn13DebugMatches);
    } else {
      console.log("❌ ISBN-13デバッグマッチなし");
    }

    // 978で始まる13桁の数字を探す（最も単純なパターン）
    const isbn13SimpleMatches = html.match(
      /978[-\s]?\d{1}[-\s]?\d{3}[-\s]?\d{5}[-\s]?\d{1}/g
    );
    if (isbn13SimpleMatches) {
      console.log("✅ 978で始まる13桁発見:", isbn13SimpleMatches);
    } else {
      console.log("❌ 978で始まる13桁なし");
    }

    // ハイフンなしの978で始まる13桁
    const isbn13NoHyphen = html.match(/978\d{10}/g);
    if (isbn13NoHyphen) {
      console.log("✅ ハイフンなし978で始まる13桁:", isbn13NoHyphen);
    } else {
      console.log("❌ ハイフンなし978で始まる13桁なし");
    }

    console.log("🔎 各パターンでISBN-13を検索中...");
    let patternIndex = 0;
    for (const pattern of isbn13Patterns) {
      patternIndex++;
      console.log(
        `📝 パターン ${patternIndex}/${
          isbn13Patterns.length
        }: ${pattern.toString()}`
      );
      const isbnMatch = html.match(pattern);
      if (isbnMatch) {
        console.log(`   ✅ マッチ発見: "${isbnMatch[0]}"`);
        console.log(`   📋 キャプチャグループ: "${isbnMatch[1]}"`);

        let isbn13 = isbnMatch[1].replace(/[-\s]/g, ""); // ハイフンとスペースを除去
        console.log(`   🧹 クリーンアップ後: "${isbn13}"`);

        // 13桁の数字であることを検証
        if (isbn13.length === 13 && /^\d{13}$/.test(isbn13)) {
          bookInfo.isbn13 = isbn13;
          bookInfo.isbn = isbn13; // 後方互換性のため
          console.log(`   🎉 ISBN-13抽出成功: "${isbn13}"`);
          break;
        } else {
          console.log(
            `   ❌ ISBN-13候補が無効: "${isbn13}" (長さ: ${
              isbn13.length
            }, 数字チェック: ${/^\d{13}$/.test(isbn13)})`
          );
        }
      } else {
        console.log(`   ❌ マッチなし`);
      }
    }

    // ISBN-13が見つからない場合、ISBN-10を抽出
    if (!bookInfo.isbn13) {
      console.log("=====================================");
      console.log("📚 ISBN-13が見つからないため、ISBN-10を検索します...");

      let isbn10PatternIndex = 0;
      for (const pattern of isbn10Patterns) {
        isbn10PatternIndex++;
        console.log(
          `📝 ISBN-10パターン ${isbn10PatternIndex}/${
            isbn10Patterns.length
          }: ${pattern.toString()}`
        );
        const isbnMatch = html.match(pattern);
        if (isbnMatch) {
          console.log(`   ✅ マッチ発見: "${isbnMatch[0]}"`);
          console.log(`   📋 キャプチャグループ: "${isbnMatch[1]}"`);

          let isbn10 = isbnMatch[1].replace(/[-\s]/g, ""); // ハイフンとスペースを除去
          console.log(`   🧹 クリーンアップ後: "${isbn10}"`);

          // 10桁で、最後の文字はXでも可
          if (isbn10.length === 10 && /^\d{9}[\dX]$/i.test(isbn10)) {
            bookInfo.isbn10 = isbn10;
            bookInfo.isbn = isbn10; // 後方互換性のため
            console.log(`   🎉 ISBN-10抽出成功: "${isbn10}"`);
            break;
          } else {
            console.log(
              `   ❌ ISBN-10候補が無効: "${isbn10}" (長さ: ${
                isbn10.length
              }, パターンチェック: ${/^\d{9}[\dX]$/i.test(isbn10)})`
            );
          }
        } else {
          console.log(`   ❌ マッチなし`);
        }
      }
    }

    console.log("Amazon書籍情報解析結果:");
    console.log(`  タイトル: ${bookInfo.title}`);
    console.log(`  著者: ${bookInfo.author}`);
    console.log(`  出版社: ${bookInfo.publisher}`);
    console.log(`  ISBN-13: ${bookInfo.isbn13}`);
    console.log(`  ISBN-10: ${bookInfo.isbn10}`);
    console.log(`  ISBN: ${bookInfo.isbn}`);
  } catch (error) {
    console.warn(`Amazon書籍情報解析エラー: ${error.message}`);
  }

  return bookInfo;
}

/**
 * HTMLエンティティをデコード
 */
function decodeHtml(html) {
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#x60;": "`",
    "&#x3D;": "=",
  };

  return html.replace(/&[#\w]+;/g, (entity) => {
    return entities[entity] || entity;
  });
}

/**
 * Amazon書籍情報からWebOPAC検索クエリを生成（ISBN優先）
 */
function generateWebOpacQueryFromAmazon(amazonBook) {
  console.log("=====================================");
  console.log("🔍 WebOPACクエリ生成中...");
  console.log("📖 抽出された書籍情報:");
  console.log("   ISBN-13:", amazonBook.isbn13 || "なし");
  console.log("   ISBN-10:", amazonBook.isbn10 || "なし");
  console.log("   タイトル:", amazonBook.title || "なし");
  console.log("   著者:", amazonBook.author || "なし");

  // ISBN-13が利用可能な場合は、ハイフンを除去して返す
  if (amazonBook.isbn13) {
    const cleanIsbn = amazonBook.isbn13.replace(/[-\s]/g, "");
    console.log(`✅ ISBN-13検索クエリ生成: "${cleanIsbn}"`);
    console.log(
      `📖 元のISBN-13: "${amazonBook.isbn13}" → 検索用: "${cleanIsbn}"`
    );
    return {
      type: "isbn",
      query: cleanIsbn,
      isbn: cleanIsbn,
    };
  }

  // ISBN-10が利用可能な場合
  if (amazonBook.isbn10) {
    const cleanIsbn = amazonBook.isbn10.replace(/[-\s]/g, "");
    console.log(`✅ ISBN-10検索クエリ生成: "${cleanIsbn}"`);
    console.log(
      `📖 元のISBN-10: "${amazonBook.isbn10}" → 検索用: "${cleanIsbn}"`
    );
    return {
      type: "isbn",
      query: cleanIsbn,
      isbn: cleanIsbn,
    };
  }

  // ISBNが利用できない場合はキーワード検索用クエリを生成
  console.log("⚠️ ISBNが見つからないため、キーワード検索を使用します");
  let query = "";

  if (amazonBook.title) {
    // タイトルを正規化（サブタイトル除去）
    let title = amazonBook.title;
    title = title.split(/[：:―－]/)[0].trim();
    title = title.replace(/第?\d+版?/g, "").trim();
    title = title.replace(/\([^)]*\)/g, "").trim();
    title = title.replace(/【[^】]*】/g, "").trim();
    query += title;
  }

  // 著者情報が信頼できない場合は、タイトルのみで検索
  if (
    amazonBook.author &&
    amazonBook.author !== "フォロー" &&
    amazonBook.author.length > 1 &&
    !amazonBook.author.match(/^(詳細|more|…|フォロー|井上)$/i)
  ) {
    // 著者名の姓を追加
    const authorName = amazonBook.author.split(/[,、\s]/)[0].trim();
    if (
      authorName &&
      authorName.length > 1 &&
      !authorName.match(/^(詳細|more|…|フォロー|井上)$/i)
    ) {
      query += ` ${authorName}`;
    }
  } else {
    // 著者情報が取得できない/信頼できない場合はタイトルのみで検索
    console.log(
      "⚠️  著者情報が不正確または取得できないため、タイトルのみで検索します"
    );
  }

  console.log(`🔍 キーワード検索クエリ生成: "${query.trim()}"`);
  return {
    type: "keyword",
    query: query.trim(),
  };
}

async function performLiveSearch(keyword, maxResults = 50) {
  console.log(`ライブ検索開始: "${keyword}"`);

  const postData = querystring.stringify({
    words: keyword,
    holar: "12",
    formkeyno: "",
    sortkey: "",
    sorttype: "",
    listcnt: maxResults.toString(),
    startpos: "",
    fromDsp: "catsre",
    srhRevTagFlg: "",
  });

  const options = {
    hostname: "libopac-c.kosen-k.go.jp",
    port: 443,
    path: "/webopac12/ctlsrh.do",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Referer: "https://libopac-c.kosen-k.go.jp/webopac12/cattab.do",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
      "Accept-Encoding": "gzip, deflate",
      Connection: "keep-alive",
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = [];

      res.on("data", (chunk) => {
        responseData.push(chunk);
      });

      res.on("end", () => {
        const buffer = Buffer.concat(responseData);

        if (res.headers["content-encoding"] === "gzip") {
          zlib.gunzip(buffer, (err, decompressed) => {
            if (err) {
              reject(new Error(`解凍エラー: ${err.message}`));
            } else {
              const html = decompressed.toString("utf8");
              console.log(
                `ライブ検索完了 (${(html.length / 1024).toFixed(1)}KB取得)`
              );
              resolve(html);
            }
          });
        } else {
          const html = buffer.toString("utf8");
          console.log(
            `ライブ検索完了 (${(html.length / 1024).toFixed(1)}KB取得)`
          );
          resolve(html);
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`リクエストエラー: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * ISBN検索を実行（詳細検索フォームのisbn_issnパラメータを使用）
 */
async function performIsbnSearch(isbn, maxResults = 50) {
  console.log(`📚 ISBN検索開始: "${isbn}"`);
  console.log(`🔍 詳細検索フォームのisbn_issnパラメータを使用します`);

  const postData = querystring.stringify({
    isbn_issn: isbn, // 詳細検索フォームで確認したISBN専用パラメータ
    search_mode: "advanced", // 詳細検索モードを指定
    listcnt: maxResults.toString(),
    startpos: "",
    fromDsp: "catsre",
    sortkey: "",
    sorttype: "",
  });

  console.log(`📤 送信データ: isbn_issn=${isbn}`);

  const options = {
    hostname: "libopac-c.kosen-k.go.jp",
    port: 443,
    path: "/webopac12/ctlsrh.do",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Referer: "https://libopac-c.kosen-k.go.jp/webopac12/cattab.do",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
      "Accept-Encoding": "gzip, deflate",
      Connection: "keep-alive",
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = [];

      res.on("data", (chunk) => {
        responseData.push(chunk);
      });

      res.on("end", () => {
        const buffer = Buffer.concat(responseData);

        if (res.headers["content-encoding"] === "gzip") {
          zlib.gunzip(buffer, (err, decompressed) => {
            if (err) {
              reject(new Error(`ISBN検索解凍エラー: ${err.message}`));
            } else {
              const html = decompressed.toString("utf8");
              console.log(
                `📚 ISBN検索完了 (${(html.length / 1024).toFixed(1)}KB取得)`
              );
              resolve(html);
            }
          });
        } else {
          const html = buffer.toString("utf8");
          console.log(
            `📚 ISBN検索完了 (${(html.length / 1024).toFixed(1)}KB取得)`
          );
          resolve(html);
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`ISBN検索リクエストエラー: ${err.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("ISBN検索タイムアウト"));
    });

    req.write(postData);
    req.end();
  });
}

// メイン実行
async function main() {
  const scraper = new WorkingOpacScraper();

  try {
    // コマンドライン引数をチェック
    const searchInput = process.argv[2];

    if (searchInput) {
      // AmazonのURLかどうかをチェック
      if (
        searchInput.includes("amazon.co.jp") ||
        searchInput.includes("amazon.com")
      ) {
        // AmazonのURL検索モード
        console.log(`AmazonのURL検索モード: ${searchInput}`);

        try {
          // AmazonのURLから書籍情報を取得
          const amazonBook = await getAmazonBookInfo(searchInput);

          if (!amazonBook.title) {
            console.log("❌ Amazon書籍情報の取得に失敗しました");
            return;
          }

          // WebOPAC検索クエリを生成（ISBN優先）
          const searchInfo = generateWebOpacQueryFromAmazon(amazonBook);

          if (!searchInfo.query) {
            console.log("❌ 有効な検索クエリを生成できませんでした");
            return;
          }

          let html = null;
          let searchType = "";
          let actualSearchQuery = "";

          // ISBN検索を優先的に実行
          if (searchInfo.type === "isbn") {
            try {
              console.log(`🔍 ISBN検索を試行中: "${searchInfo.isbn}"`);
              html = await performIsbnSearch(searchInfo.isbn);
              searchType = "ISBN";
              actualSearchQuery = searchInfo.isbn;

              // 結果を確認
              const tempScraper = new WorkingOpacScraper();
              const tempResult = tempScraper.scrapeFromHtml(html);

              if (tempResult.summary.extractedCount === 0) {
                console.log(
                  "⚠️  ISBN検索で結果が見つかりませんでした。キーワード検索にフォールバックします。"
                );
                html = null; // ISBN検索をリセット
              } else {
                console.log(
                  `✅ ISBN検索成功: ${tempResult.summary.extractedCount}件見つかりました`
                );
              }
            } catch (error) {
              console.log(
                `⚠️  ISBN検索でエラーが発生しました: ${error.message}`
              );
              console.log("🔄 キーワード検索にフォールバックします。");
            }
          }

          // ISBN検索が失敗またはISBNが利用できない場合、キーワード検索を実行
          if (!html) {
            // キーワード検索用のクエリを生成
            let keywordQuery = "";
            if (searchInfo.type === "isbn") {
              // ISBN検索が失敗した場合、タイトルと著者でキーワード検索
              if (amazonBook.title) {
                let title = amazonBook.title;
                title = title.split(/[：:―－]/)[0].trim();
                title = title.replace(/第?\d+版?/g, "").trim();
                title = title.replace(/\([^)]*\)/g, "").trim();
                title = title.replace(/【[^】]*】/g, "").trim();
                keywordQuery += title;
              }

              if (
                amazonBook.author &&
                amazonBook.author !== "フォロー" &&
                amazonBook.author.length > 1 &&
                !amazonBook.author.match(/^(詳細|more|…|フォロー)$/i)
              ) {
                const authorName = amazonBook.author.split(/[,、\s]/)[0].trim();
                if (authorName && authorName.length > 1) {
                  keywordQuery += ` ${authorName}`;
                }
              }
            } else {
              keywordQuery = searchInfo.query;
            }

            console.log(`🔍 キーワード検索を実行中: "${keywordQuery}"`);
            html = await performLiveSearch(keywordQuery);
            searchType = "キーワード";
            actualSearchQuery = keywordQuery;
          }

          // スクレイピング実行
          const result = scraper.scrapeFromHtml(html);

          // 結果表示
          console.log("\n" + "=".repeat(100));
          console.log("Amazon → WebOPAC 検索結果");
          console.log("=".repeat(100));

          console.log(`\nAmazon書籍情報:`);
          console.log(`   タイトル: ${amazonBook.title}`);
          console.log(`   著者: ${amazonBook.author || "N/A"}`);
          console.log(`   出版社: ${amazonBook.publisher || "N/A"}`);
          console.log(`   ISBN-13: ${amazonBook.isbn13 || "N/A"}`);
          console.log(`   ISBN-10: ${amazonBook.isbn10 || "N/A"}`);
          console.log(`   URL: ${amazonBook.originalUrl}`);

          console.log(`\nWebOPAC検索結果:`);
          console.log(`   検索方法: ${searchType}検索`);
          console.log(`   検索クエリ: "${actualSearchQuery}"`);
          console.log(
            `   総件数: ${result.summary.totalCount.toLocaleString()}件`
          );
          console.log(`   抽出件数: ${result.summary.extractedCount}件`);

          if (result.books.length > 0) {
            console.log(`\n✅ WebOPACに類似書籍が見つかりました:`);
            console.log("-".repeat(80));

            result.books.forEach((book, index) => {
              console.log(`\n${index + 1}. ${book.title}`);
              console.log(`   ID: ${book.bibId}`);

              if (book.author) {
                console.log(`   著者: ${book.author}`);
              }

              if (book.edition) {
                console.log(`   版: ${book.edition}`);
              }

              if (book.publisher && book.year) {
                console.log(`   出版: ${book.publisher} (${book.year}年)`);
              }

              console.log(
                `   WebOPAC URL: https://libopac-c.kosen-k.go.jp/webopac12/BB${book.bibId}`
              );
            });
          } else {
            console.log(`\n❌ WebOPACに該当する書籍が見つかりませんでした`);
            if (searchType === "ISBN") {
              console.log(
                `💡 ISBN検索で見つからない場合、書籍がWebOPACに登録されていない可能性があります`
              );
            }
          }

          console.log("\n" + "=".repeat(100));

          // ファイル出力をコメントアウト
          // const baseName = `amazon_to_webopac_${timestamp.split('T')[0]}`;
          // const resultWithAmazonInfo = {
          //   ...result,
          //   amazonBook: amazonBook,
          //   searchQuery: searchQuery
          // };
          //
          // scraper.saveToJson(resultWithAmazonInfo, `${baseName}_result.json`);
          // scraper.saveToCsv(result, `${baseName}_result.csv`);
        } catch (error) {
          console.error(`❌ Amazon検索エラー: ${error.message}`);
          return;
        }
      } else {
        // 通常のキーワード検索モード
        console.log(`ライブ検索モード: "${searchInput}"`);

        const html = await performLiveSearch(searchInput);

        // HTMLファイルに保存（デバッグ用）- コメントアウト
        // const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        // const htmlFilename = `search_${searchInput.replace(
        //   /[^a-zA-Z0-9]/g,
        //   "_"
        // )}_${timestamp}.html`;
        // fs.writeFileSync(htmlFilename, html, "utf8");
        // console.log(`デバッグ用HTMLファイル: ${htmlFilename}`);

        // スクレイピング実行
        const result = scraper.scrapeFromHtml(html);
        scraper.displayToConsole(result);

        // ファイル出力をコメントアウト
        // const baseName = searchInput.replace(/[^a-zA-Z0-9]/g, "_");
        // scraper.saveToJson(result, `${baseName}_result.json`);
        // scraper.saveToCsv(result, `${baseName}_result.csv`);
      }
    } else {
      // 既存ファイル処理モード
      console.log("既存ファイル処理モード");

      const htmlFiles = [
        "math_search_fixed.html",
        "javascript_search_fixed.html",
      ];

      for (const fileName of htmlFiles) {
        if (fs.existsSync(fileName)) {
          console.log(`\n処理中: ${fileName}`);

          const result = scraper.scrapeFromFile(fileName);
          scraper.displayToConsole(result);

          const baseName = fileName.replace(".html", "");
          scraper.saveToJson(result, `${baseName}_final.json`);
          scraper.saveToCsv(result, `${baseName}_final.csv`);

          console.log(`\n${fileName} の処理完了\n`);
        }
      }

      // 使用方法を表示
      console.log("\n使用方法:");
      console.log('  ライブ検索: node working_scraper.js "検索キーワード"');
      console.log('  例: node working_scraper.js "人工知能"');
      console.log('  例: node working_scraper.js "JavaScript"');
      console.log(
        '  AmazonのURL検索: node working_scraper.js "https://www.amazon.co.jp/dp/XXXXXXXXXX"'
      );
      console.log(
        '  例: node working_scraper.js "https://www.amazon.co.jp/dp/4274068765"'
      );
      console.log("  既存ファイル処理: node working_scraper.js");
    }
  } catch (error) {
    console.error("❌ エラーが発生しました:", error.message);
    process.exit(1);
  }
}

// モジュールとして使用可能にする
module.exports = WorkingOpacScraper;

// 直接実行された場合はメイン関数を実行
if (require.main === module) {
  main();
}
