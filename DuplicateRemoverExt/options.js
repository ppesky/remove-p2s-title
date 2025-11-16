document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["urlPatterns", "dictionary"], (res) => {
      document.getElementById("urlPatterns").value =
          (res.urlPatterns || []).join("\n");

      document.getElementById("dictionary").value =
          (res.dictionary || []).join("\n");
  });

  document.getElementById("saveBtn").addEventListener("click", () => {
      const urlPatterns = document.getElementById("urlPatterns").value
          .split("\n").map(v => v.trim()).filter(v => v);

      const dictionary = document.getElementById("dictionary").value
          .split("\n").map(v => v.trim()).filter(v => v);

      chrome.storage.sync.set({ urlPatterns, dictionary }, () => {
          alert("저장되었습니다.");
      });
  });
});
