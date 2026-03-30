/**
 * DET 复习站：题库 bank.json、按难度筛选、90s + Web Speech API 英文转写
 */

const EXAM_SECONDS = 90;

/** @type {Array<Record<string, unknown>>} */
let bank = [];
let filterDiff = "all"; // 'all' | '1' | '2' | '3'
let current = null;

const $ = (id) => document.getElementById(id);

function badgeClass(d) {
  const m = { 1: "badge-d1", 2: "badge-d2", 3: "badge-d3" };
  return m[String(d)] || "badge-d2";
}

function filteredList() {
  if (filterDiff === "all") return bank;
  return bank.filter((q) => String(q.difficulty) === filterDiff);
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
  for (const q of list) {
    const id = q.id;
    const diff = String(q.difficulty ?? "?");
    const img = q.image_url || "";
    const card = document.createElement("article");
    card.className = "card";
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.innerHTML = `
      <img src="${escapeAttr(img)}" alt="" loading="lazy" />
      <div class="meta">
        <span class="badge ${badgeClass(diff)}">难度 ${escapeHtml(diff)}</span>
        <strong>#${escapeHtml(String(id))}</strong>
      </div>
    `;
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
  const set = new Set(bank.map((q) => String(q.difficulty ?? "")));
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

  addTab("all", "全部");
  for (const lv of levels) {
    addTab(lv, `难度 ${lv}`);
  }
}

function showList() {
  stopExamInternal();
  $("view-list").classList.remove("hidden");
  $("view-exam").classList.add("hidden");
}

function openExam(q) {
  current = q;
  $("view-list").classList.add("hidden");
  $("view-exam").classList.remove("hidden");

  $("exam-img").src = q.image_url || "";
  $("exam-id").textContent = String(q.id);
  const d = String(q.difficulty ?? "?");
  const badge = $("exam-badge");
  badge.textContent = `难度 ${d}`;
  badge.className = `badge ${badgeClass(d)}`;

  $("sample-text").textContent = q.answer || "（无范文）";
  $("sample-wrap").open = false;

  resetTranscript();
  resetTimerDisplay();

  $("btn-start").classList.remove("hidden");
  $("btn-stop").classList.add("hidden");

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  $("stt-hint").textContent = SpeechRecognition
    ? ""
    : "当前浏览器不支持 Web Speech API，请使用 Chrome 桌面版进行英文转写。";
  $("mic-hint").textContent = "";
}

function resetTranscript() {
  const el = $("transcript");
  el.textContent =
    "点击「开始作答」后允许麦克风，用英语描述图片；下方为浏览器语音识别结果（仅供参考，不录音存档）。";
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
  const res = await fetch("data/bank.json", { cache: "no-store" });
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
  $("btn-start").addEventListener("click", startExam);
  $("btn-stop").addEventListener("click", finishExam);
  $("btn-random").addEventListener("click", randomQuestion);

  loadBank()
    .then((data) => {
      bank = data;
      renderDiffTabs();
      renderList();
    })
    .catch((e) => {
      $("load-err").textContent = `加载失败: ${e.message}。请先在项目根目录运行 python scripts/build_bank.py 生成 docs/data/bank.json 并推送。`;
      $("load-err").classList.remove("hidden");
    });
}

init();
