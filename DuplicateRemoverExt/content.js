// ----------------------------
// Load config from storage
// ----------------------------
let config = {
  urlPatterns: ["https://www.pick2sell.kr/product/*?tab=basicInfo"],
  dictionary: [] // 사용자 커스텀 단어 (선택)
};

// URL 패턴 매칭
function urlMatch() {
  return config.urlPatterns.some(pattern => {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return regex.test(location.href);
  });
}

// 설정 로드 및 초기화
function initExtension() {
  chrome.storage.sync.get(["urlPatterns", "dictionary"], (res) => {
    if (res.urlPatterns) config.urlPatterns = res.urlPatterns;
    if (res.dictionary) config.dictionary = res.dictionary;

    if (!urlMatch()) {
      console.log("URL not matched. Extension inactive.");
      return;
    }

    // DOM이 준비된 후 UI 생성
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", createFloatingUI);
    } else {
      createFloatingUI();
    }
  });
}

initExtension();

// ----------------------------
// DOM Element Finders
// ----------------------------

// A: category div
function getInputA() {
  return document.querySelector("div.typo-text-md-medium");
}

// B: product-name-input
function getInputB() {
  return document.querySelector('input[data-testid="product-name-input"]');
}

// C: 3번째 INPUT with same class as B (index 2)
function getInputC() {
  const allInputs = [...document.querySelectorAll("input.sc-cqnWLZ.hMxkNV")];
  // 총 4개가 있다고 했으므로, 3번째는 index 2
  if (allInputs.length >= 3) {
    return allInputs[2]; // 0-based index이므로 2가 3번째
  }
  return null;
}

// ----------------------------
// Function 1: 2글자 이상 단어 중복 제거
// 독립된 단어는 유지하고, 다른 단어에서 해당 부분을 제거
// 예: "야외 야외고양이집" -> "야외 고양이집"
// ----------------------------
function removeDuplicateWords(text) {
  if (!text) return "";

  let words = text.split(/\s+/).filter(w => w.length > 0); // 빈 문자열 제거
  console.log("Input words:", words);

  // 1. 먼저 완전히 동일한 단어 중복 제거
  let uniqueWords = [];
  for (let word of words) {
    if (!uniqueWords.includes(word)) {
      uniqueWords.push(word);
    }
  }
  
  // 2. 독립된 단어 목록 수집 (2글자 이상)
  let independentWords = uniqueWords.filter(w => w.length >= 2);
  console.log("Independent words:", independentWords);
  
  // 3. 각 단어 처리
  let result = [];
  
  for (let word of uniqueWords) {
    // 1글자 단어는 그대로 추가
    if (word.length < 2) {
      result.push(word);
      continue;
    }
    
    // 현재 단어가 다른 독립된 단어로 시작하거나 포함되어 있는지 확인
    let processedWord = word;
    let foundPrefix = false;
    
    // 길이가 긴 순서대로 정렬하여 긴 단어부터 확인 (예: "야외고양이집"이 "야외"보다 먼저 확인되면 안됨)
    const sortedIndependent = [...independentWords].sort((a, b) => b.length - a.length);
    
    for (let independentWord of sortedIndependent) {
      if (word === independentWord) {
        // 자기 자신과 동일하면 독립 단어로 추가 (다른 단어에 포함되지 않는 경우)
        // 하지만 다른 독립 단어에 포함되어 있는지 먼저 확인해야 함
        continue; // 자기 자신은 나중에 처리
      } else if (word.startsWith(independentWord)) {
        // 독립 단어로 시작하면 해당 부분 제거
        processedWord = word.substring(independentWord.length);
        console.log(`Word "${word}" starts with "${independentWord}", removing prefix -> "${processedWord}"`);
        foundPrefix = true;
        break;
      } else if (word.includes(independentWord) && word.length > independentWord.length) {
        // 독립 단어가 포함되어 있으면 제거 (시작 부분이 아닌 경우도 처리)
        processedWord = word.replace(independentWord, "");
        console.log(`Word "${word}" contains "${independentWord}", removing -> "${processedWord}"`);
        foundPrefix = true;
        break;
      }
    }
    
    // 접두사가 발견되지 않았으면 독립 단어로 추가
    if (!foundPrefix) {
      // 다른 단어에 포함되지 않는 독립 단어
      if (!result.includes(word)) {
        result.push(word);
      }
    } else if (processedWord && processedWord !== word) {
      // 처리된 단어가 있고 변경되었으면 추가
      if (processedWord.length > 0 && !result.includes(processedWord)) {
        result.push(processedWord);
      }
    }
  }

  const finalResult = result.join(" ");
  console.log("Output words:", result);
  console.log("Result:", finalResult);
  return finalResult;
}

// ----------------------------
// Function 2: "생활용품" 포함 시 C에 "비브랜드 " 추가
// ----------------------------
function autoBrandTag() {
  const A = getInputA();
  const C = getInputC();

  if (!A || !C) {
    console.log("Input A or C not found");
    return;
  }

  const categoryText = A.innerText;

  if (categoryText.includes("생활용품")) {
      if (!C.value.startsWith("비브랜드")) {
          setInputValue(C, "비브랜드 " + C.value);
      }
  }
}

// ----------------------------
// 메시지 표시 함수
// ----------------------------
function showMessage(text) {
  // 기존 메시지가 있으면 제거
  const existingMsg = document.getElementById("extensionMessage");
  if (existingMsg) {
    existingMsg.remove();
  }

  const msg = document.createElement("div");
  msg.id = "extensionMessage";
  msg.textContent = text;
  msg.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #4CAF50;
    color: white;
    padding: 15px 30px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: bold;
    z-index: 1000000;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    pointer-events: none;
  `;
  document.body.appendChild(msg);

  setTimeout(() => {
    msg.style.opacity = "0";
    msg.style.transition = "opacity 0.3s";
    setTimeout(() => msg.remove(), 300);
  }, 1000);
}

// ----------------------------
// Execute All
// ----------------------------
function setInputValue(input, value) {
  if (!input) return false;
  
  // React나 다른 프레임워크를 위한 이벤트 발생
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 
    "value"
  )?.set;
  
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }
  
  // input 이벤트 발생 (React, Vue 등이 감지할 수 있도록)
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  return true;
}

function runRemoveDuplicates(showMsg = true) {
  const B = getInputB();
  if (!B) {
    console.log("Input B not found");
    if (showMsg) showMessage("입력 필드를 찾을 수 없습니다");
    return;
  }
  
  const originalValue = B.value;
  console.log("Original value:", originalValue);
  console.log("Original value length:", originalValue.length);
  
  const newValue = removeDuplicateWords(originalValue);
  console.log("New value:", newValue);
  console.log("New value length:", newValue.length);
  console.log("Values are equal:", originalValue === newValue);
  
  if (originalValue !== newValue) {
    setInputValue(B, newValue);
    console.log("Value changed:", originalValue, "->", newValue);
    if (showMsg) showMessage("중복 제거 완료");
  } else {
    console.log("No duplicates found - original and new values are the same");
    if (showMsg) showMessage("중복된 단어가 없습니다");
  }
}

function runBrandTag(showMsg = true) {
  autoBrandTag();
  if (showMsg) showMessage("실행했습니다");
}

function runAll() {
  runRemoveDuplicates(false);
  autoBrandTag();
  showMessage("실행했습니다");
}

// ----------------------------
// Floating UI
// ----------------------------
function createFloatingUI() {
  const box = document.createElement("div");
  box.id = "floatingToolBox";
  box.innerHTML = `
      <button id="btnRemove">중복제거</button>
      <button id="btnBrand">비브랜드태그</button>
      <button id="btnAll">전체실행</button>
  `;
  document.body.appendChild(box);

  // Load saved position
  chrome.storage.sync.get("floatPos", res => {
      if (res.floatPos) {
          box.style.left = res.floatPos.left;
          box.style.top = res.floatPos.top;
      }
  });

  // Dragging
  let isDown = false, offsetX, offsetY;

  box.addEventListener("mousedown", e => {
      // 버튼 클릭 시에는 드래그 시작하지 않음
      if (e.target.tagName === "BUTTON") {
          return;
      }
      isDown = true;
      offsetX = e.offsetX;
      offsetY = e.offsetY;
      e.preventDefault();
  });

  document.addEventListener("mousemove", e => {
      if (!isDown) return;
      box.style.left = `${e.pageX - offsetX}px`;
      box.style.top = `${e.pageY - offsetY}px`;
  });

  document.addEventListener("mouseup", () => {
      if (!isDown) return;
      isDown = false;

      chrome.storage.sync.set({
          floatPos: { left: box.style.left, top: box.style.top }
      });
  });

  // Button actions - 이벤트 위임 사용
  box.addEventListener("click", (e) => {
      if (e.target.tagName !== "BUTTON") return;
      
      e.stopPropagation();
      e.preventDefault();
      
      const btnId = e.target.id;
      
      if (btnId === "btnRemove") {
          runRemoveDuplicates();
      } else if (btnId === "btnBrand") {
          runBrandTag();
      } else if (btnId === "btnAll") {
          runAll();
      }
  });
}
