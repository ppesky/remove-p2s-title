// Centralized extension defaults.
// Loaded by options.html (script tag) and by content/background (via manifest/importScripts).
globalThis.P2S_DEFAULTS = {
  urlPatterns: ["https://www.pick2sell.kr/product/*"],
  dictionary: [],
  inputBSelector: 'input[data-testid="product-name-input-container-common"]',
  inputCSelector: 'input[data-testid="product-name-input-container-쿠팡"]',
  completeDelayMs: 400,
  backBtnSelector: "button.sc-jgFdch.evvnFR",
};

