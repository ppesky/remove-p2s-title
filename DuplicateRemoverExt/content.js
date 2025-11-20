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
  const allInputs = [...document.querySelectorAll("input.sc-dIGTRn.iItIMS")];
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
  
  // 현재 포커스 상태 저장
  const wasFocused = document.activeElement === input;
  
  // React를 위한 실제 focus/blur 시뮬레이션
  if (!wasFocused) {
    input.focus();
  }
  
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
  
  // React를 위한 더 구체적인 이벤트 발생
  // InputEvent 사용 (React가 더 잘 감지함)
  const inputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    data: value,
    inputType: 'insertText'
  });
  input.dispatchEvent(inputEvent);
  
  // ChangeEvent
  const changeEvent = new Event('change', { bubbles: true, cancelable: true });
  input.dispatchEvent(changeEvent);
  
  // React의 synthetic event를 위한 추가 이벤트
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  
  // 실제 blur 호출 (React가 blur 이벤트를 감지하도록)
  if (!wasFocused) {
    input.blur();
  } else {
    // 이미 포커스가 있었다면 blur 이벤트만 발생
    const blurEvent = new FocusEvent('blur', { bubbles: true, cancelable: true });
    input.dispatchEvent(blurEvent);
  }
  
  // React의 onChange 핸들러를 직접 찾아서 호출 시도
  const reactInternalKey = Object.keys(input).find(key => 
    key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber')
  );
  
  if (reactInternalKey) {
    const reactInternal = input[reactInternalKey];
    if (reactInternal) {
      // React의 props에서 onChange 찾기
      let fiber = reactInternal;
      while (fiber) {
        if (fiber.memoizedProps && fiber.memoizedProps.onChange) {
          const syntheticEvent = {
            target: input,
            currentTarget: input,
            bubbles: true,
            cancelable: true,
            defaultPrevented: false,
            eventPhase: 3,
            isTrusted: false,
            nativeEvent: inputEvent,
            preventDefault: () => {},
            stopPropagation: () => {},
            type: 'change'
          };
          try {
            fiber.memoizedProps.onChange(syntheticEvent);
          } catch (e) {
            console.log('React onChange call failed:', e);
          }
          break;
        }
        fiber = fiber.return;
      }
    }
  }
  
  return true;
}

const DUP_REMOVE_MAX_ITER = 10;

function delay(ms = 200) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runRemoveDuplicates(showMsg = true) {
  const B = getInputB();
  if (!B) {
    console.log("Input B not found");
    if (showMsg) showMessage("입력 필드를 찾을 수 없습니다");
    return;
  }

  let iteration = 0;
  let changedAtLeastOnce = false;

  while (iteration < DUP_REMOVE_MAX_ITER) {
    iteration++;
    const originalValue = B.value;
    const newValue = removeDuplicateWords(originalValue);

    console.log(`[DupRemove][${iteration}] original:`, originalValue);
    console.log(`[DupRemove][${iteration}] new:`, newValue);

    if (originalValue === newValue) {
      console.log(`[DupRemove] No more duplicates after ${iteration - 1} iterations`);
      if (showMsg) {
        showMessage(changedAtLeastOnce ? "모든 중복 제거 완료" : "중복된 단어가 없습니다");
      }
      return;
    }

    changedAtLeastOnce = true;
    setInputValue(B, newValue);

    // React 상태 업데이트 대기
    await delay(250);
  }

  console.log("[DupRemove] Max iteration reached. There may still be duplicates.");
  if (showMsg) showMessage("중복 제거 완료 (최대 반복)");
}

function runBrandTag(showMsg = true) {
  autoBrandTag();
  if (showMsg) showMessage("실행했습니다");
}

async function runAll() {
  // 중복제거가 완료된 후 비브랜드태그 실행
  await runRemoveDuplicates(false);
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

  // 화면 경계 내에 위치 제한하는 함수
  function constrainPosition(x, y) {
    const boxRect = box.getBoundingClientRect();
    const maxX = window.innerWidth - boxRect.width;
    const maxY = window.innerHeight - boxRect.height;
    
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    
    return { x, y };
  }

  // 위치가 화면 내에 있는지 확인 (간단한 범위 체크)
  function isValidPosition(left, top) {
    try {
      const leftNum = parseInt(left);
      const topNum = parseInt(top);
      
      if (isNaN(leftNum) || isNaN(topNum)) return false;
      
      // 기본적인 범위 체크 (음수이거나 너무 큰 값은 제외)
      // 실제 화면 크기는 나중에 constrainPosition에서 처리
      return leftNum >= -1000 && leftNum <= window.innerWidth + 1000 &&
             topNum >= -1000 && topNum <= window.innerHeight + 1000;
    } catch (e) {
      return false;
    }
  }

  // 위치 리셋 함수
  function resetPosition() {
    box.style.left = "50%";
    box.style.top = "20px";
    box.style.transform = "translateX(-50%)";
    chrome.storage.sync.remove("floatPos");
    showMessage("위치가 초기화되었습니다");
  }

  // Load saved position
  chrome.storage.sync.get("floatPos", res => {
      if (res.floatPos && res.floatPos.left && res.floatPos.top) {
          // 저장된 위치가 유효한지 확인
          if (isValidPosition(res.floatPos.left, res.floatPos.top)) {
              box.style.left = res.floatPos.left;
              box.style.top = res.floatPos.top;
              box.style.transform = "none";
              
              // 위치를 설정한 후 화면 경계 내에 있는지 확인하고 조정
              setTimeout(() => {
                  const boxRect = box.getBoundingClientRect();
                  const currentX = parseInt(box.style.left) || 0;
                  const currentY = parseInt(box.style.top) || 0;
                  const constrained = constrainPosition(currentX, currentY);
                  
                  if (constrained.x !== currentX || constrained.y !== currentY) {
                      box.style.left = `${constrained.x}px`;
                      box.style.top = `${constrained.y}px`;
                  }
              }, 100);
          } else {
              // 유효하지 않으면 기본 위치로
              resetPosition();
          }
      } else {
          // 저장된 위치가 없으면 기본 위치
          resetPosition();
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
      box.style.transform = "none"; // 드래그 시작 시 transform 제거
      e.preventDefault();
  });

  document.addEventListener("mousemove", e => {
      if (!isDown) return;
      
      let newX = e.pageX - offsetX;
      let newY = e.pageY - offsetY;
      
      // 화면 경계 내에 제한
      const constrained = constrainPosition(newX, newY);
      newX = constrained.x;
      newY = constrained.y;
      
      box.style.left = `${newX}px`;
      box.style.top = `${newY}px`;
  });

  document.addEventListener("mouseup", () => {
      if (!isDown) return;
      isDown = false;

      // 현재 위치 저장
      const left = box.style.left;
      const top = box.style.top;
      chrome.storage.sync.set({
          floatPos: { left, top }
      });
  });

  // 더블클릭으로 위치 리셋
  box.addEventListener("dblclick", (e) => {
      if (e.target.tagName === "BUTTON") return;
      resetPosition();
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
