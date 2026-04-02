/**
 * DET 复习站：首页选题 → 看图 / 阅读说话 / 口语样本（key=c）独立界面
 */

const EXAM_SECONDS = 90;

/**
 * docs/ 站点根（末尾带 /）。用于 fetch 与图片地址，避免 GitHub Pages 项目站无尾斜杠时
 * 相对路径被解析到 github.io 域名根导致 404，题库加载失败、首页按钮会一直 disabled。
 */
const DOCS_ROOT = new URL("../", import.meta.url);

/** @param {unknown} path 相对 docs 的路径或完整 http(s) URL */
function resolveAssetUrl(path) {
  if (path == null || path === "") return "";
  const s = String(path);
  if (/^https?:\/\//i.test(s)) return s;
  return new URL(s.replace(/^\//, ""), DOCS_ROOT).href;
}

/** @type {Array<Record<string, unknown>>} */
let bank = [];
let filterDiff = "all"; // 'all' | '1' | '2' | '3'
/** @type {'a' | 'e' | 'c' | null} 仅在进入某一题型后非 null */
let mode = null;
/** @type {Record<string, unknown> | null} */
let current = null;

const $ = (id) => document.getElementById(id);

function questionKey(q) {
  const k = String(q.key ?? "a").toLowerCase();
  if (k === "e") return "e";
  if (k === "c") return "c";
  return "a";
}

/** 无配图、展示英文题干与 extData（翻译/模板）的题型：阅读说话、口语样本 */
function isTextExamKind(q) {
  const k = questionKey(q);
  return k === "e" || k === "c";
}

function examKindLabel(q) {
  const k = questionKey(q);
  if (k === "e") return "阅读";
  if (k === "c") return "口语样本";
  return "看图";
}

/** @param {Record<string, unknown>} q */
function parseExtData(q) {
  const raw = q.extData;
  if (raw == null || typeof raw !== "string") return {};
  try {
    const o = JSON.parse(raw);
    return typeof o === "object" && o !== null ? o : {};
  } catch {
    return {};
  }
}

function badgeClass(d) {
  const m = { 1: "badge-d1", 2: "badge-d2", 3: "badge-d3" };
  return m[String(d)] || "badge-d2";
}

function baseForMode() {
  if (mode == null) return [];
  return bank.filter((q) => questionKey(q) === mode);
}

function filteredList() {
  let list = baseForMode();
  if (filterDiff !== "all") {
    list = list.filter((q) => String(q.difficulty) === filterDiff);
  }
  return list;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function renderList() {
  const grid = $("grid");
  const empty = $("empty");
  const list = filteredList();
  grid.innerHTML = "";
  if (list.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const textMode = mode === "e" || mode === "c";

  for (const q of list) {
    const id = q.id;
    const diff = String(q.difficulty ?? "?");
    const card = document.createElement("article");
    card.className = textMode ? "card card-text" : "card";
    card.setAttribute("role", "button");
    card.tabIndex = 0;

    if (textMode) {
      const raw = String(q.title || "").replace(/\r\n/g, "\n");
      const oneLine = raw.split("\n").join(" ").replace(/\s+/g, " ").trim();
      const preview = oneLine.slice(0, 160);
      card.innerHTML = `
        <div class="card-preview">${escapeHtml(preview)}${oneLine.length > 160 ? "…" : ""}</div>
        <div class="meta">
          <span class="badge ${badgeClass(diff)}">难度 ${escapeHtml(diff)}</span>
          <strong>#${escapeHtml(String(id))}</strong>
        </div>
      `;
    } else {
      const img = resolveAssetUrl(q.image_url || "");
      card.innerHTML = `
        <img src="${escapeAttr(img)}" alt="" loading="lazy" />
        <div class="meta">
          <span class="badge ${badgeClass(diff)}">难度 ${escapeHtml(diff)}</span>
          <strong>#${escapeHtml(String(id))}</strong>
        </div>
      `;
    }

    card.addEventListener("click", () => openExam(q));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openExam(q);
      }
    });
    grid.appendChild(card);
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function renderDiffTabs() {
  const set = new Set(baseForMode().map((q) => String(q.difficulty ?? "")));
  const levels = [...set].filter(Boolean).sort();
  const tabs = $("diff-tabs");
  tabs.innerHTML = "";

  function addTab(value, label) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.dataset.diff = value;
    if (value === filterDiff) b.classList.add("active");
    b.addEventListener("click", () => {
      filterDiff = value;
      tabs.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      renderList();
    });
    tabs.appendChild(b);
  }

  addTab("all", "全部难度");
  for (const lv of levels) {
    addTab(lv, `难度 ${lv}`);
  }
}

function setHeaderDesc(text) {
  const el = $("header-desc");
  if (el) el.textContent = text;
}

function showHome() {
  stopExamInternal();
  mode = null;
  $("view-home").classList.remove("hidden");
  $("view-list").classList.add("hidden");
  $("view-exam").classList.add("hidden");
  setHeaderDesc("先选择题型进入对应复习界面 · 模拟 90 秒 · 英文转写（不保存）");
}

/**
 * @param {'a' | 'e' | 'c'} kind
 */
function enterMode(kind) {
  mode = kind;
  filterDiff = "all";
  $("view-home").classList.add("hidden");
  $("view-list").classList.remove("hidden");
  $("view-exam").classList.add("hidden");

  const titles = { a: "看图说话", e: "阅读说话", c: "口语样本" };
  $("list-title").textContent = titles[kind] ?? "题库";

  const descs = {
    a: "当前：看图说话 · 返回选题可切换其它题型",
    e: "当前：阅读说话（无配图）· 返回选题可切换其它题型",
    c: "当前：口语样本（无配图）· 返回选题可切换其它题型",
  };
  setHeaderDesc(descs[kind] ?? "");

  renderDiffTabs();
  renderList();
}

function showList() {
  stopExamInternal();
  $("view-list").classList.remove("hidden");
  $("view-exam").classList.add("hidden");
}

function setTextExamUI(textMode) {
  const imgWrap = $("exam-image-wrap");
  const promptWrap = $("exam-prompt-wrap");
  const translateWrap = $("translate-wrap");
  const templateWrap = $("template-wrap");
  const tr = $("transcript");

  if (textMode) {
    imgWrap.classList.add("hidden");
    promptWrap.classList.remove("hidden");
    translateWrap.classList.remove("hidden");
    templateWrap.classList.remove("hidden");
  } else {
    imgWrap.classList.remove("hidden");
    promptWrap.classList.add("hidden");
    translateWrap.classList.add("hidden");
    templateWrap.classList.add("hidden");
  }

  if (textMode) {
    tr.textContent =
      "点击「开始作答」后允许麦克风，用英语回答题目；下方为浏览器语音识别结果（仅供参考，不录音存档）。";
  } else {
    tr.textContent =
      "点击「开始作答」后允许麦克风，用英语描述图片；下方为浏览器语音识别结果（仅供参考，不录音存档）。";
  }
  tr.classList.add("placeholder");
}

function openExam(q) {
  current = q;
  const textMode = isTextExamKind(q);
  $("view-list").classList.add("hidden");
  $("view-exam").classList.remove("hidden");

  setTextExamUI(textMode);

  $("exam-id").textContent = String(q.id);
  const d = String(q.difficulty ?? "?");
  const badge = $("exam-badge");
  badge.textContent = `${examKindLabel(q)} · 难度 ${d}`;
  badge.className = `badge ${badgeClass(d)}`;

  if (textMode) {
    const title = String(q.title || "（无题目）");
    $("exam-prompt").textContent = title;
    const ext = parseExtData(q);
    $("translate-text").textContent = String(ext.titleTranslate || "（暂无参考翻译）");
    $("sample-text").textContent = String(q.answer || "（无范文）");
    $("template-text").textContent = String(ext.answerTemplate || "（暂无答题模板）");
    $("translate-wrap").open = false;
    $("sample-wrap").open = false;
    $("template-wrap").open = false;
  } else {
    $("exam-img").src = resolveAssetUrl(q.image_url || "");
    $("sample-text").textContent = String(q.answer || "（无范文）");
    $("sample-wrap").open = false;
  }

  resetTranscript(textMode);
  resetTimerDisplay();

  $("btn-start").classList.remove("hidden");
  $("btn-stop").classList.add("hidden");

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  $("stt-hint").textContent = SpeechRecognition
    ? ""
    : "当前浏览器不支持 Web Speech API，请使用 Chrome 桌面版进行英文转写。";
  $("mic-hint").textContent = "";
}

/** @param {boolean} textMode */
function resetTranscript(textMode) {
  const el = $("transcript");
  if (textMode) {
    el.textContent =
      "点击「开始作答」后允许麦克风，用英语回答题目；下方为浏览器语音识别结果（仅供参考，不录音存档）。";
  } else {
    el.textContent =
      "点击「开始作答」后允许麦克风，用英语描述图片；下方为浏览器语音识别结果（仅供参考，不录音存档）。";
  }
  el.classList.add("placeholder");
}

function resetTimerDisplay() {
  const t = $("timer");
  t.textContent = formatTime(EXAM_SECONDS);
  t.classList.remove("warning", "danger");
}

let recognition = null;
let tickId = null;
let timeLeft = EXAM_SECONDS;
let examActive = false;
let finalTranscript = "";

function stopExamInternal() {
  examActive = false;
  if (tickId != null) {
    clearInterval(tickId);
    tickId = null;
  }
  if (recognition) {
    try {
      recognition.onend = null;
      recognition.stop();
    } catch (_) {
      /* ignore */
    }
    recognition = null;
  }
}

function startExam() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $("mic-hint").textContent = "无法启动：浏览器不支持语音识别。";
    return;
  }

  stopExamInternal();

  finalTranscript = "";
  const tr = $("transcript");
  tr.classList.remove("placeholder");
  tr.textContent = "";

  timeLeft = EXAM_SECONDS;
  examActive = true;
  $("btn-start").classList.add("hidden");
  $("btn-stop").classList.remove("hidden");
  $("mic-hint").textContent = "识别中…若中途断开会自动续听，直至 90 秒结束。";

  const rec = new SpeechRecognition();
  recognition = rec;
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += piece + " ";
      } else {
        interim += piece;
      }
    }
    tr.textContent = (finalTranscript + interim).trim() || "…";
  };

  rec.onerror = (e) => {
    console.warn("SpeechRecognition error", e);
    $("mic-hint").textContent = `识别提示: ${e.error || "unknown"}（若仍为 listening 可继续说）`;
  };

  rec.onend = () => {
    if (examActive && timeLeft > 0 && recognition === rec) {
      try {
        rec.start();
      } catch (_) {
        /* already started */
      }
    }
  };

  try {
    rec.start();
  } catch (e) {
    $("mic-hint").textContent = `无法启动麦克风/识别: ${e.message || e}`;
    examActive = false;
    $("btn-start").classList.remove("hidden");
    $("btn-stop").classList.add("hidden");
    return;
  }

  const timerEl = $("timer");
  tickId = window.setInterval(() => {
    timeLeft -= 1;
    timerEl.textContent = formatTime(Math.max(0, timeLeft));
    timerEl.classList.remove("warning", "danger");
    if (timeLeft <= 10) timerEl.classList.add("danger");
    else if (timeLeft <= 30) timerEl.classList.add("warning");

    if (timeLeft <= 0) {
      finishExam();
    }
  }, 1000);
}

function finishExam() {
  stopExamInternal();
  $("btn-start").classList.remove("hidden");
  $("btn-stop").classList.add("hidden");
  $("mic-hint").textContent = "本轮已结束。可再次点击「开始作答」重试。";
}

async function loadBank() {
  const res = await fetch(new URL("data/bank.json", DOCS_ROOT), { cache: "no-store" });
  if (!res.ok) throw new Error(`无法加载题库 (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("题库格式错误");
  return data;
}

function randomQuestion() {
  const list = filteredList();
  if (list.length === 0) return;
  const q = list[Math.floor(Math.random() * list.length)];
  openExam(q);
}

function init() {
  $("btn-back").addEventListener("click", showList);
  $("btn-back-home").addEventListener("click", showHome);
  $("btn-mode-image").addEventListener("click", () => enterMode("a"));
  $("btn-mode-read").addEventListener("click", () => enterMode("e"));
  $("btn-mode-sample").addEventListener("click", () => enterMode("c"));
  $("btn-start").addEventListener("click", startExam);
  $("btn-stop").addEventListener("click", finishExam);
  $("btn-random").addEventListener("click", randomQuestion);

  loadBank()
    .then((data) => {
      bank = data;
      $("btn-mode-image").disabled = false;
      $("btn-mode-read").disabled = false;
      $("btn-mode-sample").disabled = false;
    })
    .catch((e) => {
      $("view-home").classList.add("hidden");
      $("load-err").textContent = `加载失败: ${e.message}。请先在项目根目录运行 python scripts/build_bank.py 生成 docs/data/bank.json 并推送。`;
      $("load-err").classList.remove("hidden");
    });
}

init();
