document.addEventListener("DOMContentLoaded", function () {
  console.log("ポップアップ: DOM読み込み完了");

  // 高専ID一覧
  const colleges = {
    "01": "函館工業高等専門学校",
    "02": "苫小牧工業高等専門学校",
    "03": "釧路工業高等専門学校",
    "04": "旭川工業高等専門学校",
    "05": "八戸工業高等専門学校",
    "06": "一関工業高等専門学校",
    "08": "仙台高等専門学校",
    "09": "秋田工業高等専門学校",
    10: "鶴岡工業高等専門学校",
    11: "福島工業高等専門学校",
    12: "茨城工業高等専門学校",
    13: "小山工業高等専門学校",
    14: "群馬工業高等専門学校",
    15: "木更津工業高等専門学校",
    16: "東京工業高等専門学校",
    17: "長岡工業高等専門学校",
    18: "富山高等専門学校",
    20: "石川工業高等専門学校",
    21: "福井工業高等専門学校",
    22: "長野工業高等専門学校",
    23: "岐阜工業高等専門学校",
    24: "沼津工業高等専門学校",
    25: "豊田工業高等専門学校",
    26: "鳥羽商船高等専門学校",
    27: "鈴鹿工業高等専門学校",
    28: "舞鶴工業高等専門学校",
    29: "明石工業高等専門学校",
    30: "奈良工業高等専門学校",
    31: "和歌山工業高等専門学校",
    32: "米子工業高等専門学校",
    33: "松江工業高等専門学校",
    34: "津山工業高等専門学校",
    35: "広島商船高等専門学校",
    36: "呉工業高等専門学校",
    37: "徳山工業高等専門学校",
    38: "宇部工業高等専門学校",
    39: "大島商船高等専門学校",
    40: "阿南工業高等専門学校",
    41: "香川高等専門学校",
    43: "新居浜工業高等専門学校",
    44: "弓削商船高等専門学校",
    45: "高知工業高等専門学校",
    46: "久留米工業高等専門学校",
    47: "有明工業高等専門学校",
    48: "北九州工業高等専門学校",
    49: "佐世保工業高等専門学校",
    50: "熊本高等専門学校",
    52: "大分工業高等専門学校",
    53: "都城工業高等専門学校",
    54: "鹿児島工業高等専門学校",
    55: "沖縄工業高等専門学校",
  };

  // デフォルトの高専ID
  let selectedCollegeId = "12";

  // 保存された設定を読み込み
  chrome.storage.sync.get(["selectedCollegeId"], function (result) {
    console.log("ポップアップ: 設定読み込み結果:", result);

    if (result.selectedCollegeId) {
      selectedCollegeId = result.selectedCollegeId;
      console.log("ポップアップ: 保存された高専ID:", selectedCollegeId);
      document.getElementById("collegeSelect").value = selectedCollegeId;
    } else {
      console.log(
        "ポップアップ: 保存された設定なし、デフォルト使用:",
        selectedCollegeId
      );
    }

    // 初期化後に表示を更新
    updateCurrentSelection();
    updateLibraryLink();
    console.log("ポップアップ: 初期化完了");
  });

  // 関数定義をここに移動
  function updateCurrentSelection() {
    console.log("ポップアップ: updateCurrentSelection呼び出し");
    console.log("ポップアップ: selectedCollegeId:", selectedCollegeId);
    console.log("ポップアップ: colleges:", colleges);

    const collegeName = colleges[selectedCollegeId];
    console.log("ポップアップ: collegeName:", collegeName);

    const currentSelectionElement = document.getElementById("currentSelection");
    if (currentSelectionElement) {
      const newText = `現在の設定: ${collegeName} (webopac${selectedCollegeId})`;
      console.log("ポップアップ: 新しいテキスト:", newText);
      currentSelectionElement.textContent = newText;
      console.log("ポップアップ: 表示更新完了");
    } else {
      console.error("ポップアップ: currentSelection要素が見つかりません");
    }
  }

  function updateLibraryLink() {
    console.log("ポップアップ: updateLibraryLink呼び出し");
    const link = document.getElementById("libraryLink");
    if (link) {
      link.href = `https://libopac-c.kosen-k.go.jp/webopac${selectedCollegeId}/cattab.do`;
      console.log("ポップアップ: リンク更新:", link.href);
    } else {
      console.error("ポップアップ: libraryLink要素が見つかりません");
    }
  }

  // 高専選択の変更イベント
  document
    .getElementById("collegeSelect")
    .addEventListener("change", function () {
      selectedCollegeId = this.value;
      console.log("ポップアップ: 高専ID変更:", selectedCollegeId);

      // 設定を保存
      chrome.storage.sync.set(
        { selectedCollegeId: selectedCollegeId },
        function () {
          console.log(
            "ポップアップ: 高専設定を保存しました:",
            selectedCollegeId
          );
        }
      );

      updateCurrentSelection();
      updateLibraryLink();

      // アクティブなタブにメッセージを送信して設定を更新
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0] && tabs[0].url) {
          const url = tabs[0].url;
          let shouldSendMessage = false;

          if (url.includes("amazon.co.jp")) {
            console.log(
              "ポップアップ: Amazonタブにメッセージ送信中...",
              tabs[0].id
            );
            shouldSendMessage = true;
          } else if (url.includes("books.rakuten.co.jp")) {
            console.log(
              "ポップアップ: 楽天ブックスタブにメッセージ送信中...",
              tabs[0].id
            );
            shouldSendMessage = true;
          }

          if (shouldSendMessage) {
            chrome.tabs.sendMessage(
              tabs[0].id,
              {
                action: "updateCollegeId",
                collegeId: selectedCollegeId,
              },
              function (response) {
                if (chrome.runtime.lastError) {
                  console.error(
                    "ポップアップ: メッセージ送信エラー:",
                    chrome.runtime.lastError.message
                  );
                } else {
                  console.log("ポップアップ: メッセージ送信成功:", response);
                }
              }
            );
          } else {
            console.log(
              "ポップアップ: 対応サイトではないため、メッセージを送信しません"
            );
          }
        }
      });
    });

  // 現在のタブの情報を表示
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const currentTab = tabs[0];
    const url = currentTab.url;

    if (
      url.includes("amazon.co.jp") &&
      (url.includes("/dp/") || url.includes("/gp/product/"))
    ) {
      document.getElementById("currentPage").textContent = "Amazon 書籍ページ";
      document.getElementById("status").style.color = "#007600";
    } else if (url.includes("amazon.co.jp")) {
      document.getElementById("currentPage").textContent =
        "Amazon (書籍ページではありません)";
      document.getElementById("status").style.color = "#b12704";
    } else if (url.includes("books.rakuten.co.jp") && url.includes("/rb/")) {
      document.getElementById("currentPage").textContent = "Rakuten ブックス";
      document.getElementById("status").style.color = "#007600";
    } else if (url.includes("books.rakuten.co.jp")) {
      document.getElementById("currentPage").textContent =
        "Rakuten ブックス (書籍ページではありません)";
      document.getElementById("status").style.color = "#b12704";
    } else {
      document.getElementById("currentPage").textContent =
        "対応サイトではありません";
      document.getElementById("status").style.color = "#666";
    }
  });
}); // DOMContentLoaded終了
