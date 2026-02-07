chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["urlPatterns", "dictionary", "inputCSelector"], (res) => {
    // 초기 설정이 없을 때만 기본값 설정
    if (!res.urlPatterns) {
      chrome.storage.sync.set({
        urlPatterns: ["https://www.pick2sell.kr/product/*"],
        dictionary: [],
        inputCSelector: "input.sc-iafpwu.UboKk"
      });
    }
  });
});