document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["urlPatterns", "dictionary", "inputCSelector", "completeDelayMs"], (res) => {
      document.getElementById("urlPatterns").value =
          (res.urlPatterns || []).join("\n");

      document.getElementById("dictionary").value =
          (res.dictionary || []).join("\n");

      document.getElementById("inputCSelector").value = res.inputCSelector || "";

      const delayEl = document.getElementById("completeDelayMs");
      delayEl.value = res.completeDelayMs != null ? res.completeDelayMs : 400;
  });

  document.getElementById("saveBtn").addEventListener("click", () => {
      const urlPatterns = document.getElementById("urlPatterns").value
          .split("\n").map(v => v.trim()).filter(v => v);

      const dictionary = document.getElementById("dictionary").value
          .split("\n").map(v => v.trim()).filter(v => v);

      const inputCSelector = document.getElementById("inputCSelector").value.trim();

      let completeDelayMs = parseInt(document.getElementById("completeDelayMs").value, 10);
      if (isNaN(completeDelayMs) || completeDelayMs < 100) completeDelayMs = 100;
      if (completeDelayMs > 3000) completeDelayMs = 3000;

      chrome.storage.sync.set({ urlPatterns, dictionary, inputCSelector, completeDelayMs }, () => {
          alert("저장되었습니다.");
      });
  });
});
