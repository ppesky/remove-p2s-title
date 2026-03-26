importScripts(chrome.runtime.getURL("defaults.js"));

const DEFAULTS = globalThis.P2S_DEFAULTS;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    ["urlPatterns", "dictionary", "inputBSelector", "inputCSelector", "completeDelayMs", "backBtnSelector"],
    (res) => {
      if (!DEFAULTS) {
        console.error("P2S_DEFAULTS not found. Make sure defaults.js is loaded.");
        return;
      }

      // 이전 기본값(업그레이드 전 저장된 값)과 같을 때만 새 기본값으로 마이그레이션
      // - 사용자가 커스텀한 값은 건드리지 않음
      const LEGACY = {
        inputBSelector: 'input.sc-fQffii.hkKAnT',
        inputCSelector: 'input.sc-iafpwu.UboKk',
      };

      const updates = {};

      if (!res.urlPatterns) updates.urlPatterns = DEFAULTS.urlPatterns;
      if (!res.dictionary) updates.dictionary = DEFAULTS.dictionary;

      if (!res.inputBSelector || res.inputBSelector === LEGACY.inputBSelector) {
        updates.inputBSelector = DEFAULTS.inputBSelector;
      }

      if (!res.inputCSelector || res.inputCSelector === LEGACY.inputCSelector) {
        updates.inputCSelector = DEFAULTS.inputCSelector;
      }

      if (res.completeDelayMs == null) updates.completeDelayMs = DEFAULTS.completeDelayMs;
      if (!res.backBtnSelector) updates.backBtnSelector = DEFAULTS.backBtnSelector;

      if (Object.keys(updates).length > 0) {
        chrome.storage.sync.set(updates);
      }
    }
  );
});