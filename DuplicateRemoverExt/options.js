document.addEventListener("DOMContentLoaded", () => {
  const DEFAULTS = globalThis.P2S_DEFAULTS;
  if (!DEFAULTS) {
    console.error("P2S_DEFAULTS not found. Make sure defaults.js is loaded.");
    return;
  }

  chrome.storage.sync.get(
    [
      "urlPatterns",
      "dictionary",
      "inputBSelector",
      "inputCSelector",
      "completeDelayMs",
      "backBtnSelector",
      "skipBrandOnRunAll",
    ],
    (res) => {
      document.getElementById("urlPatterns").value =
        (res.urlPatterns || DEFAULTS.urlPatterns).join("\n");

      document.getElementById("dictionary").value =
        (res.dictionary || DEFAULTS.dictionary).join("\n");

      document.getElementById("inputBSelector").value =
        res.inputBSelector || DEFAULTS.inputBSelector;

      document.getElementById("inputCSelector").value =
        res.inputCSelector || DEFAULTS.inputCSelector;

      const delayEl = document.getElementById("completeDelayMs");
      delayEl.value =
        res.completeDelayMs != null ? res.completeDelayMs : DEFAULTS.completeDelayMs;

      const backBtnInput = document.getElementById("backBtnSelector");
      if (backBtnInput) {
        backBtnInput.value = res.backBtnSelector || DEFAULTS.backBtnSelector;
      }

      const skipBrandEl = document.getElementById("skipBrandOnRunAll");
      if (skipBrandEl) {
        skipBrandEl.checked =
          res.skipBrandOnRunAll != null
            ? Boolean(res.skipBrandOnRunAll)
            : DEFAULTS.skipBrandOnRunAll;
      }
    }
  );

  document.getElementById("saveBtn").addEventListener("click", () => {
    const urlPatterns = document
      .getElementById("urlPatterns")
      .value.split("\n")
      .map(v => v.trim())
      .filter(v => v);

    const dictionary = document
      .getElementById("dictionary")
      .value.split("\n")
      .map(v => v.trim())
      .filter(v => v);

    const inputBSelector = document
      .getElementById("inputBSelector")
      .value.trim() || DEFAULTS.inputBSelector;

    const inputCSelector = document
      .getElementById("inputCSelector")
      .value.trim() || DEFAULTS.inputCSelector;

    let completeDelayMs = parseInt(
      document.getElementById("completeDelayMs").value,
      10
    );
    if (isNaN(completeDelayMs) || completeDelayMs < 100) completeDelayMs = 100;
    if (completeDelayMs > 3000) completeDelayMs = 3000;

    const backBtnSelector = document
      .getElementById("backBtnSelector")
      .value.trim() || DEFAULTS.backBtnSelector;

    const safeUrlPatterns =
      urlPatterns.length > 0 ? urlPatterns : DEFAULTS.urlPatterns;

    const skipBrandOnRunAll = Boolean(
      document.getElementById("skipBrandOnRunAll")?.checked
    );

    chrome.storage.sync.set(
      {
        urlPatterns: safeUrlPatterns,
        dictionary,
        inputBSelector,
        inputCSelector,
        completeDelayMs,
        backBtnSelector,
        skipBrandOnRunAll,
      },
      () => {
        alert("저장되었습니다.");
      }
    );
  });
});
