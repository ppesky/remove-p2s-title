// ----------------------------
// Load config from storage
// ----------------------------
const DEFAULTS = globalThis.P2S_DEFAULTS;
let config = DEFAULTS
  ? {
      urlPatterns: DEFAULTS.urlPatterns,
      dictionary: DEFAULTS.dictionary, // 사용자 커스텀 단어 (선택)
      inputBSelector: DEFAULTS.inputBSelector, // 상품명 중복 제거 대상 Input 선택자
      inputCSelector: DEFAULTS.inputCSelector, // Input C 선택자
      completeDelayMs: DEFAULTS.completeDelayMs, // 완료 버튼 클릭 후 뒤로가기까지 지연(ms)
      backBtnSelector: DEFAULTS.backBtnSelector, // 완료 후 뒤로가기 버튼 선택자
    }
  : {
      urlPatterns: [],
      dictionary: [],
      inputBSelector: "",
      inputCSelector: "",
      completeDelayMs: 0,
      backBtnSelector: "",
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
  chrome.storage.sync.get(
    ["urlPatterns", "dictionary", "inputBSelector", "inputCSelector", "completeDelayMs", "backBtnSelector"],
    (res) => {
      if (res.urlPatterns) config.urlPatterns = res.urlPatterns;
      if (res.dictionary) config.dictionary = res.dictionary;
      if (res.inputBSelector) config.inputBSelector = res.inputBSelector;
      if (res.inputCSelector) config.inputCSelector = res.inputCSelector;
      if (res.completeDelayMs != null) config.completeDelayMs = res.completeDelayMs;
      if (res.backBtnSelector) config.backBtnSelector = res.backBtnSelector;

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
    }
  );
}

initExtension();

// ----------------------------
// DOM Element Finders
// ----------------------------

// A: category div
function getInputA() {
  return document.querySelector("div.typo-text-md-medium");
}

function resolveInputLikeElement(el) {
  if (!el) return null;

  const tag = (el.tagName || "").toLowerCase();
  const isDirectInput = tag === "input" || tag === "textarea";
  if (isDirectInput) return el;

  const isContentEditable =
    !!el.isContentEditable || String(el.getAttribute?.("contenteditable") || "").toLowerCase() === "true";
  if (isContentEditable) return el;

  // Selector가 container일 때, 내부의 실제 input/textarea를 찾는다.
  const inner = el.querySelector("input, textarea");
  return inner || null;
}

function getInputElementText(el) {
  if (!el) return "";
  // HTMLInputElement/HTMLTextAreaElement
  if (typeof el.value === "string") return el.value;
  // contenteditable div 등
  return (el.textContent || el.innerText || "").toString();
}

// B: 상품명 중복 제거 대상 input
function getInputB(opts = {}) {
  const silent = !!opts.silent;
  const fallbackSelectors = [
    config.inputBSelector,
    // 컨테이너일 수 있는 경우
    '[data-testid="product-name-input-container-common"]',
    '[data-testid="product-name-input-container-common"] input, [data-testid="product-name-input-container-common"] textarea',
    // 과거/대체 케이스: data-testid 기반
    'input[data-testid="product-name-input"]',
    // 과거/대체 케이스: sc selector 기반(사용자 설정/저장값이 예전일 수 있음)
    'input.sc-fQffii.hkKAnT',
  ].filter(Boolean);

  for (const selector of fallbackSelectors) {
    if (!selector) continue;
    const el = document.querySelector(selector);
    const resolved = resolveInputLikeElement(el);
    if (resolved) {
      if (!silent) {
        console.log("[DupRemove] getInputB found:", {
          selectorUsed: selector,
          tagName: resolved.tagName,
          isContentEditable: !!resolved.isContentEditable,
        });
      }
      return resolved;
    }
  }

  if (!silent) {
    const counts = fallbackSelectors.reduce((acc, selector) => {
      try {
        acc[selector] = document.querySelectorAll(selector).length;
      } catch (e) {
        acc[selector] = `invalid selector: ${e && e.message ? e.message : e}`;
      }
      return acc;
    }, {});

    console.warn("[DupRemove] getInputB not found:", {
      inputBSelector: config.inputBSelector,
      selectorCounts: counts,
    });
  }
  return null;
}

// C: 쿠팡 상품명 입력 (과거에 여러 개가 있어 index 2를 쓰던 케이스를 보완)
function getInputC() {
  const candidateSelectors = [
    config.inputCSelector,
    // 컨테이너일 수 있는 경우
    '[data-testid="product-name-input-container-쿠팡"]',
    '[data-testid="product-name-input-container-쿠팡"] input, [data-testid="product-name-input-container-쿠팡"] textarea',
    // 과거/대체 케이스: sc selector 기반
    "input.sc-iafpwu.UboKk",
    // 최후: 공통 data-testid input
    'input[data-testid="product-name-input"]',
  ].filter(Boolean);

  for (const selector of candidateSelectors) {
    if (!selector) continue;
    const allMatches = [...document.querySelectorAll(selector)];
    const inputs = allMatches.map(resolveInputLikeElement).filter(Boolean);
    if (inputs.length === 0) continue;
    const picked = inputs.length >= 3 ? inputs[2] : inputs[0];
    console.log("[DupRemove] getInputC found:", {
      selectorUsed: selector,
      tagName: picked.tagName,
      isContentEditable: !!picked.isContentEditable,
    });
    return picked;
  }

  const counts = candidateSelectors.reduce((acc, selector) => {
    try {
      acc[selector] = document.querySelectorAll(selector).length;
    } catch (e) {
      acc[selector] = `invalid selector: ${e && e.message ? e.message : e}`;
    }
    return acc;
  }, {});

  console.warn("[DupRemove] getInputC not found:", {
    inputCSelector: config.inputCSelector,
    selectorCounts: counts,
  });
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
    console.log("Input A or C not found", {
      inputCSelector: config.inputCSelector,
    });
    return;
  }

  const categoryText = A.innerText;

  if (categoryText.includes("생활용품")) {
      const cText = getInputElementText(C);
      if (!cText.startsWith("비브랜드")) {
          setInputValue(C, "비브랜드 " + cText);
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
  
  // React onChange 감지는 value setter + input/change 이벤트로 처리하고,
  // focus 자체는 주지 않아서(레이어 유발 방지) blur/escape로 정리한다.
  function forceFocusAwayFrom(el) {
    try {
      // contenteditable이면 selection도 정리
      if (el && el.isContentEditable) {
        const sel = window.getSelection?.();
        sel?.removeAllRanges?.();
      }
      el?.blur?.();
      // focusout/blur를 직접 dispatch (일부 React UI는 이 이벤트만 보고 닫히기도 함)
      try {
        el?.dispatchEvent(
          new FocusEvent("focusout", { bubbles: true, cancelable: true })
        );
        el?.dispatchEvent(
          new FocusEvent("blur", { bubbles: true, cancelable: true })
        );
      } catch (e) {}
    } catch (e) {}

    // React 팝업/자동완성 같은 것들은 "외부 클릭"이나 "Escape"로 닫는 경우가 많다.
    try {
      setTimeout(() => {
        try {
          const body = document.body;
          body?.dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })
          );
          body?.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
          );
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true })
          );
        } catch (e) {}
      }, 0);
    } catch (e) {}
  }
  
  // contenteditable 요소면 textContent로 값 설정
  const isContentEditable =
    !!input.isContentEditable ||
    String(input.getAttribute?.("contenteditable") || "").toLowerCase() === "true";
  if (isContentEditable) {
    input.textContent = value;
    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      data: value,
      inputType: "insertText",
    });
    input.dispatchEvent(inputEvent);
    input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));

    // blur 후 포커스를 input 밖으로 이동
    forceFocusAwayFrom(input);
    return true;
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
  
  // blur는 아래 forceFocusAwayFrom에서 통일 처리한다.
  
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

  // blur 후 포커스를 input 밖으로 이동
  forceFocusAwayFrom(input);

  return true;
}

const DUP_REMOVE_MAX_ITER = 10;

function delay(ms = 200) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runRemoveDuplicates(showMsg = true) {
  const B = getInputB();
  if (!B) {
    console.log("Input B not found", {
      inputBSelector: config.inputBSelector,
    });
    if (showMsg) showMessage("입력 필드를 찾을 수 없습니다");
    return;
  }

  let iteration = 0;
  let changedAtLeastOnce = false;

  while (iteration < DUP_REMOVE_MAX_ITER) {
    iteration++;
    const originalValue = getInputElementText(B);
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

// 대표 썸네일 추천 버튼 클릭
function runSelectMainImage(showMsg = true) {
  const btn = document.querySelector('button[data-testid="select-main-image-button"]');
  if (!btn) {
    if (showMsg) showMessage("대표 썸네일 버튼을 찾을 수 없습니다");
    return;
  }
  btn.click();
  if (showMsg) showMessage("대표 썸네일 추천 실행했습니다");
}

async function runAll() {
  // 중복제거 → (옵션) 비브랜드태그 → 대표 썸네일 추천
  await runRemoveDuplicates(false);
  // 중복제거로 인한 React 상태 반영 타이밍을 기다린다
  await delay(350);
  const skipBrand = await new Promise((resolve) => {
    chrome.storage.sync.get(["skipBrandOnRunAll"], (res) => {
      resolve(Boolean(res.skipBrandOnRunAll));
    });
  });
  if (!skipBrand) {
    autoBrandTag();
  }
  runSelectMainImage(false);
  showMessage("실행했습니다");
}

// 완료: 수정완료 체크 후 뒤로가기 버튼 클릭
async function runComplete(showMsg = true) {
  const checkbox = document.getElementById("isEditedCompleted");
  if (!checkbox) {
    if (showMsg) showMessage("편집완료 체크박스를 찾을 수 없습니다");
    return;
  }
  if (checkbox.checked) {
    if (showMsg) showMessage("이미 편집완료 처리되어 있습니다");
    // return;
  } else {
    // React가 인식하도록 네이티브 클릭으로 체크 (두 번 클릭이 필요한 케이스 고려)
    checkbox.click();
    checkbox.click();
    // React 처리 대기 후 뒤로가기 버튼 클릭
    await delay(config.completeDelayMs);
  }
  const backBtn = document.querySelector(config.backBtnSelector);
  if (!backBtn) {
    if (showMsg) showMessage("뒤로가기 버튼을 찾을 수 없습니다");
    return;
  }
  backBtn.click();
  if (showMsg) showMessage("완료 처리했습니다");
}

// ----------------------------
// Floating quick options (비브랜드 건너뛰기 등)
// ----------------------------
let p2sFloatOptionsOutsideHandler = null;
let p2sFloatOptionsEscapeHandler = null;

function closeP2sFloatOptionsPanel(panel) {
  if (!panel) return;
  panel.style.display = "none";
  if (p2sFloatOptionsOutsideHandler) {
    document.removeEventListener("mousedown", p2sFloatOptionsOutsideHandler, true);
    p2sFloatOptionsOutsideHandler = null;
  }
  if (p2sFloatOptionsEscapeHandler) {
    document.removeEventListener("keydown", p2sFloatOptionsEscapeHandler, true);
    p2sFloatOptionsEscapeHandler = null;
  }
}

function positionP2sFloatOptionsPanel(panel, anchorEl) {
  const margin = 8;
  const r = anchorEl.getBoundingClientRect();
  panel.style.visibility = "hidden";
  panel.style.display = "block";
  const w = panel.offsetWidth || 280;
  let left = r.left;
  let top = r.bottom + margin;
  left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
  const h = panel.offsetHeight || 1;
  if (top + h > window.innerHeight - margin) {
    top = Math.max(margin, r.top - h - margin);
  }
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.visibility = "visible";
}

function openP2sFloatOptionsPanel(panel, anchorBox) {
  const defaults = globalThis.P2S_DEFAULTS;
  const defSkip = defaults && defaults.skipBrandOnRunAll != null ? Boolean(defaults.skipBrandOnRunAll) : false;

  chrome.storage.sync.get(["skipBrandOnRunAll"], (res) => {
    const cb = panel.querySelector("#p2sSkipBrandOnRunAll");
    if (cb) {
      cb.checked =
        res.skipBrandOnRunAll != null ? Boolean(res.skipBrandOnRunAll) : defSkip;
    }

    closeP2sFloatOptionsPanel(panel);
    positionP2sFloatOptionsPanel(panel, anchorBox);

    p2sFloatOptionsOutsideHandler = (e) => {
      if (panel.contains(e.target) || anchorBox.contains(e.target)) return;
      closeP2sFloatOptionsPanel(panel);
    };
    p2sFloatOptionsEscapeHandler = (e) => {
      if (e.key === "Escape") closeP2sFloatOptionsPanel(panel);
    };

    setTimeout(() => {
      document.addEventListener("mousedown", p2sFloatOptionsOutsideHandler, true);
      document.addEventListener("keydown", p2sFloatOptionsEscapeHandler, true);
    }, 0);
  });
}

function createP2sFloatOptionsPanel() {
  const panel = document.createElement("div");
  panel.id = "p2sFloatOptionsPanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "빠른 설정");
  panel.style.display = "none";
  panel.innerHTML = `
    <div class="p2s-float-options-title">빠른 설정</div>
    <label class="p2s-float-options-row">
      <input type="checkbox" id="p2sSkipBrandOnRunAll">
      <span>전체 실행 시 비브랜드 태그 건너뛰기</span>
    </label>
    <div class="p2s-float-options-actions">
      <button type="button" class="p2s-float-options-btn p2s-float-options-btn-primary" id="p2sFloatOptionsSave">저장</button>
      <button type="button" class="p2s-float-options-btn" id="p2sFloatOptionsClose">닫기</button>
    </div>
    <button type="button" class="p2s-float-options-link" id="p2sOpenFullOptions">전체 옵션 페이지 열기…</button>
  `;
  document.body.appendChild(panel);

  panel.addEventListener("click", (e) => {
    const t = e.target;
    if (t.id === "p2sFloatOptionsSave") {
      e.preventDefault();
      e.stopPropagation();
      const checked = Boolean(panel.querySelector("#p2sSkipBrandOnRunAll")?.checked);
      chrome.storage.sync.set({ skipBrandOnRunAll: checked }, () => {
        showMessage("저장했습니다");
        closeP2sFloatOptionsPanel(panel);
      });
    } else if (t.id === "p2sFloatOptionsClose") {
      e.preventDefault();
      e.stopPropagation();
      closeP2sFloatOptionsPanel(panel);
    } else if (t.id === "p2sOpenFullOptions") {
      e.preventDefault();
      e.stopPropagation();
      closeP2sFloatOptionsPanel(panel);
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS_PAGE" });
    }
  });

  return panel;
}

// ----------------------------
// Floating UI
// ----------------------------
function createFloatingUI() {
  const box = document.createElement("div");
  box.id = "floatingToolBox";
  // iframe/top frame 중 입력이 없는 프레임에서는 UI를 숨겨서 잘못된 프레임에서 버튼을 누르는 걸 방지
  box.style.display = "none";
  box.innerHTML = `
      <button id="btnRemove">중복제거</button>
      <button id="btnThumb">대표썸</button>
      <button id="btnBrand">비브랜드</button>
      <button id="btnAll">전체</button>
      <span class="float-pipe">|</span>
      <button id="btnComplete">완료</button>
      <span class="float-pipe">|</span>
      <button type="button" id="btnSettings" title="빠른 설정" aria-label="빠른 설정">⚙</button>
  `;
  document.body.appendChild(box);

  const optionsPanel = createP2sFloatOptionsPanel();

  // 입력이 렌더링되기까지 짧게 대기 후, 잡히는 프레임에서만 UI 표시
  let attempts = 0;
  const maxAttempts = 12; // 약 3.6초
  const intervalMs = 300;
  const timer = setInterval(() => {
    attempts++;
    if (getInputB({ silent: true })) {
      box.style.display = "block";
      clearInterval(timer);
      return;
    }
    if (attempts >= maxAttempts) {
      clearInterval(timer);
      closeP2sFloatOptionsPanel(optionsPanel);
      optionsPanel.remove();
      box.remove();
    }
  }, intervalMs);

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
      // 버튼·파이프 클릭 시에는 드래그 시작하지 않음
      if (e.target.tagName === "BUTTON" || e.target.classList.contains("float-pipe")) {
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
      } else if (btnId === "btnThumb") {
          runSelectMainImage();
      } else if (btnId === "btnAll") {
          runAll();
      } else if (btnId === "btnSettings") {
          if (optionsPanel.style.display === "block") {
            closeP2sFloatOptionsPanel(optionsPanel);
          } else {
            openP2sFloatOptionsPanel(optionsPanel, box);
          }
      } else if (btnId === "btnComplete") {
          runComplete();
      }
  });
}
