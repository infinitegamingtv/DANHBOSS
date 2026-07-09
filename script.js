const USE_GENERATED_AUDIO = false;
const GENERATED_AUDIO = {
  lobby: "assets/audio/lobby-loop.mp3",
  battle: "assets/audio/battle-loop.mp3",
  hit: "assets/audio/hit.mp3",
  correct: "assets/audio/correct.mp3",
  wrong: "assets/audio/wrong.mp3",
  victory: "assets/audio/victory.mp3",
  click: "assets/audio/click.mp3"
};

const BOSS_CONFIG = {
  dragon: { name: "Rồng Lửa", image: "assets/boss-dragon.png", fallback: "🐲" },
  robot: { name: "Robot Khổng Lồ", image: "assets/boss-robot.png", fallback: "🤖" },
  slime: { name: "Slime Vũ Trụ", image: "assets/boss-slime.png", fallback: "👾" }
};

const APP_SESSION_KEY = "classBossBattleSessionV1";
const ROOM_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ANSWER_LOCK_MS = 900;
const NEXT_QUESTION_DELAY_MS = 950;


let currentUser = { uid: "user_" + Math.random().toString(36).substr(2, 9) };

let currentQuestion = null;
let questionNumber = 0;
let answerLocked = false;
let victoryShown = false;
let finishingRoom = false;
let gameTimerInterval = null;
let previousTotalDamage = 0;

const state = {
  role: null,
  roomCode: null,
  displayName: null,
  meta: null,
  players: {},
  sortedPlayers: []
};

/* --------------------------------- DOM ---------------------------------- */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const screens = {
  home: $("#homeScreen"),
  teacherSetup: $("#teacherSetupScreen"),
  studentJoin: $("#studentJoinScreen"),
  room: $("#roomScreen")
};

const ui = {
  connectionBadge: $("#connectionBadge"),
  audioBtn: $("#audioBtn"),
  teacherNameInput: $("#teacherNameInput"),
  classNameInput: $("#classNameInput"),
  bossTypeInput: $("#bossTypeInput"),
  bossHpInput: $("#bossHpInput"),
  roomCodeInput: $("#roomCodeInput"),
  studentNameInput: $("#studentNameInput"),
  roleLabel: $("#roleLabel"),
  roomClassName: $("#roomClassName"),
  roomTeacherName: $("#roomTeacherName"),
  roomCodeDisplay: $("#roomCodeDisplay"),
  gameStatusPill: $("#gameStatusPill"),
  gameTimerDisplay: $("#gameTimerDisplay"),
  bossNameDisplay: $("#bossNameDisplay"),
  totalDamageDisplay: $("#totalDamageDisplay"),
  bossImage: $("#bossImage"),
  bossHpCurrent: $("#bossHpCurrent"),
  bossHpMax: $("#bossHpMax"),
  bossHpBar: $("#bossHpBar"),
  hpTrack: $(".hp-track"),
  damageFloatLayer: $("#damageFloatLayer"),
  teacherControls: $("#teacherControls"),
  studentGamePanel: $("#studentGamePanel"),
  playerCountTeacher: $("#playerCountTeacher"),
  lockRoomToggle: $("#lockRoomToggle"),
  startGameBtn: $("#startGameBtn"),
  pauseGameBtn: $("#pauseGameBtn"),
  resetGameBtn: $("#resetGameBtn"),
  endGameBtn: $("#endGameBtn"),
  waitingPanel: $("#waitingPanel"),
  waitingTitle: $("#waitingTitle"),
  waitingMessage: $("#waitingMessage"),
  quizPanel: $("#quizPanel"),
  questionCategory: $("#questionCategory"),
  questionCounter: $("#questionCounter"),
  questionText: $("#questionText"),
  answerGrid: $("#answerGrid"),
  answerFeedback: $("#answerFeedback"),
  myDamageDisplay: $("#myDamageDisplay"),
  myComboDisplay: $("#myComboDisplay"),
  leaderboardPanel: $("#leaderboardPanel"),
  leaderboardList: $("#leaderboardList"),
  toastContainer: $("#toastContainer")
};

/* --------------------------------- UI ----------------------------------- */
function showScreen(screenName) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[screenName].classList.add("active");
  if (screenName === "room") document.body.style.overflow = "hidden";
  else document.body.style.overflow = "auto";
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<div class="toast-message">${message}</div><button class="toast-close">&times;</button>`;
  
  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.onclick = () => { toast.classList.add("hiding"); setTimeout(() => toast.remove(), 300); };
  
  setTimeout(() => { if (toast.parentNode) closeBtn.onclick(); }, 4000);
  ui.toastContainer.appendChild(toast);
}

function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Đang xử lý...";
    btn.disabled = true;
  } else {
    if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
    btn.disabled = false;
  }
}

function syncUI() {
  if (!state.roomCode) return;

  state.sortedPlayers = getSortedPlayers();
  const meta = state.meta || {};
  const isHostUser = isHost();

  ui.roomClassName.textContent = meta.className || "Lớp Học";
  ui.roomTeacherName.textContent = `Giáo viên: ${meta.teacherName || "---"}`;
  ui.roomCodeDisplay.textContent = state.roomCode;
  ui.roleLabel.textContent = isHostUser ? "Vai trò: Giáo viên" : `Học sinh: ${state.displayName}`;

  ui.teacherControls.classList.toggle("hidden", !isHostUser);
  ui.studentGamePanel.classList.toggle("hidden", isHostUser);
  ui.playerCountTeacher.textContent = `Số học sinh: ${state.sortedPlayers.length}`;

  const statusMap = {
    waiting: { text: "Sảnh Chờ", color: "var(--warning)", bg: "rgba(253, 203, 110, 0.2)" },
    playing: { text: "Đang Chiến Đấu", color: "var(--success)", bg: "rgba(0, 184, 148, 0.2)" },
    paused: { text: "Tạm Dừng", color: "var(--warning)", bg: "rgba(253, 203, 110, 0.2)" },
    finished: { text: "Chiến Thắng", color: "var(--success)", bg: "rgba(0, 184, 148, 0.2)" },
    failed: { text: "Thất Bại", color: "var(--danger)", bg: "rgba(214, 48, 49, 0.2)" }
  };
  const st = statusMap[meta.status] || statusMap.waiting;
  ui.gameStatusPill.textContent = st.text;
  ui.gameStatusPill.style.color = st.color;
  ui.gameStatusPill.style.backgroundColor = st.bg;

  if (isHostUser) {
    ui.lockRoomToggle.checked = !!meta.roomLocked;
    ui.startGameBtn.classList.toggle("hidden", meta.status !== "waiting" && meta.status !== "paused");
    ui.pauseGameBtn.classList.toggle("hidden", meta.status !== "playing");
    ui.resetGameBtn.classList.toggle("hidden", meta.status !== "finished" && meta.status !== "failed" && meta.status !== "playing" && meta.status !== "paused");
    ui.endGameBtn.classList.toggle("hidden", meta.status === "finished" || meta.status === "failed" || meta.status === "waiting");
  } else {
    ui.waitingPanel.classList.toggle("hidden", meta.status === "playing");
    ui.quizPanel.classList.toggle("hidden", meta.status !== "playing");
    
    if (meta.status === "waiting") {
      ui.waitingTitle.textContent = "Đang ở Sảnh chờ";
      ui.waitingMessage.textContent = "Vui lòng chờ giáo viên bắt đầu trận đấu...";
    } else if (meta.status === "paused") {
      ui.waitingTitle.textContent = "Tạm dừng";
      ui.waitingMessage.textContent = "Giáo viên đã tạm dừng trò chơi.";
    } else if (meta.status === "finished") {
      ui.waitingTitle.textContent = "Chiến thắng!";
      ui.waitingMessage.textContent = "Chúc mừng! Boss đã bị hạ gục.";
    } else if (meta.status === "failed") {
      ui.waitingTitle.textContent = "Thất bại!";
      ui.waitingMessage.textContent = "Quái vật đã nổi loạn! Hẹn gặp lại lần sau.";
      ui.waitingPanel.classList.remove("hidden");
      ui.quizPanel.classList.add("hidden");
    }

    if (meta.status === "playing" && !currentQuestion) {
      nextQuestion();
    }
  }

  renderRoomInfo();
  renderLeaderboard();
  updateTimerDisplay();
  updateBossVisuals();
  
  if (!isHostUser) {
    const me = getMyPlayer();
    ui.myDamageDisplay.textContent = getPlayerDamage(me);
    ui.myComboDisplay.textContent = getPlayerCombo(me);
  }
}


function updateTimerDisplay() {
  if (!state.meta?.startTime || !state.meta?.durationMs) {
    if(ui.gameTimerDisplay) ui.gameTimerDisplay.parentElement.style.display = "none";
    return;
  }
  if(ui.gameTimerDisplay) ui.gameTimerDisplay.parentElement.style.display = "block";
  
  if (gameTimerInterval) clearInterval(gameTimerInterval);
  gameTimerInterval = setInterval(() => {
    if (!state.meta || state.meta.status === "waiting") {
       clearInterval(gameTimerInterval);
       return;
    }
    
    // Freeze timer visually if not playing
    if (state.meta.status !== "playing") {
        clearInterval(gameTimerInterval);
        return; 
    }
    
    const elapsed = Date.now() - state.meta.startTime;
    let remaining = Math.max(0, state.meta.durationMs - elapsed);
    
    const mins = Math.floor(remaining / 60000).toString().padStart(2, '0');
    const secs = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
    if(ui.gameTimerDisplay) ui.gameTimerDisplay.textContent = `${mins}:${secs}`;
    
    if (remaining <= 0 && state.meta.status === "playing" && isHost()) {
      clearInterval(gameTimerInterval);
      if (getBossHp() > 0) failGame(); 
    }
  }, 200);
}

function updateBossVisuals() {
  const hp = getBossHp();
  const maxHp = Number(state.meta?.maxBossHp || 1000);
  const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;
  
  ui.bossImage.classList.remove("boss-phase-2", "boss-phase-3", "defeated", "enraged");
  
  if (state.meta?.status === "failed") {
    ui.bossImage.classList.add("enraged");
  } else if (hp <= 0 || state.meta?.status === "finished") {
    ui.bossImage.classList.add("defeated");
  } else {
    if (hpPercent < 20) {
      ui.bossImage.classList.add("boss-phase-3");
    } else if (hpPercent < 50) {
      ui.bossImage.classList.add("boss-phase-2");
    }
  }
}

async function failGame() {
  await updateRoomMeta({ status: "failed" });
  showToast("HẾT GIỜ! Quái vật đã nổi loạn!", "error");
}

function renderRoomInfo() {
  const meta = state.meta || {};
  const boss = BOSS_CONFIG[meta.bossType] || BOSS_CONFIG.dragon;
  
  ui.bossNameDisplay.textContent = boss.name;
  ui.bossImage.src = boss.image;
  ui.bossImage.onerror = () => { ui.bossImage.style.display = 'none'; };
  
  const totalDmg = getTotalDamage();
  const maxHp = Number(meta.maxBossHp || 1000);
  const hp = Math.max(0, maxHp - totalDmg);
  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  
  ui.bossHpCurrent.textContent = hp;
  ui.bossHpMax.textContent = maxHp;
  ui.bossHpBar.style.width = `${hpPercent}%`;
  ui.totalDamageDisplay.textContent = totalDmg;

  if (hpPercent < 25) ui.bossHpBar.style.backgroundColor = "var(--danger)";
  else if (hpPercent < 50) ui.bossHpBar.style.backgroundColor = "var(--warning)";
  else ui.bossHpBar.style.backgroundColor = "var(--success)";

  ui.bossImage.classList.toggle("taking-damage", totalDmg > previousTotalDamage);
  if (totalDmg > previousTotalDamage) {
    showDamageFloat(totalDmg - previousTotalDamage);
    previousTotalDamage = totalDmg;
    setTimeout(() => ui.bossImage.classList.remove("taking-damage"), 200);
  }

  if (hp <= 0 && meta.status === "playing" && !finishingRoom) {
    finishingRoom = true;
    if (isHost()) endGame();
    audioEngine.playSfx("victory");
    showVictoryModal();
  }
}

function showDamageFloat(amount) {
  if (amount <= 0) return;
  const el = document.createElement("div");
  el.className = "damage-float";
  el.textContent = `-${amount}`;
  const randomX = Math.floor(Math.random() * 80) - 40;
  el.style.left = `calc(50% + ${randomX}px)`;
  ui.damageFloatLayer.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function renderLeaderboard() {
  ui.leaderboardList.innerHTML = "";
  if (state.sortedPlayers.length === 0) {
    ui.leaderboardList.innerHTML = `<li class="lb-empty">Chưa có học sinh nào.</li>`;
    return;
  }
  state.sortedPlayers.forEach((p, i) => {
    const isMe = p.uid === currentUser?.uid;
    const rankNode = i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
    const combo = p.stats?.combo > 2 ? `<span class="lb-combo">🔥 ${p.stats.combo}</span>` : "";
    
    const li = document.createElement("li");
    li.className = `lb-item ${isMe ? "me" : ""}`;
    li.innerHTML = `
      <div class="lb-rank">${rankNode}</div>
      <img class="lb-avatar" src="${p.profile?.avatar || 'assets/avatars/avatar_1.png'}" alt="" onerror="this.style.display='none'">
      <div class="lb-info">
        <div class="lb-name">${escapeHtml(p.profile?.name || "Ẩn danh")} ${isMe ? "(Bạn)" : ""}</div>
        <div class="lb-stats">✅ ${p.stats?.correct || 0} &nbsp; ❌ ${p.stats?.wrong || 0} ${combo}</div>
      </div>
      <div class="lb-damage">${p.stats?.damage || 0}</div>
    `;
    ui.leaderboardList.appendChild(li);
  });
}

function showVictoryModal() {
  if (victoryShown) return;
  victoryShown = true;
  triggerConfetti();
  
  const modal = $("#victoryModal");
  modal.classList.add("active");
  
  const top3 = state.sortedPlayers.slice(0, 3);
  const podium = $("#podium");
  podium.innerHTML = "";
  
  const buildSpot = (player, rank, heightClass) => {
    if (!player) return `<div class="podium-spot ${heightClass} empty"></div>`;
    return `
      <div class="podium-spot ${heightClass}">
        <div class="podium-avatar"><img src="${player.profile?.avatar}" alt=""></div>
        <div class="podium-name">${escapeHtml(player.profile?.name)}</div>
        <div class="podium-score">${player.stats?.damage || 0} dmg</div>
        <div class="podium-rank">${rank}</div>
      </div>
    `;
  };
  
  podium.innerHTML += buildSpot(top3[1], "2", "rank-2");
  podium.innerHTML += buildSpot(top3[0], "1", "rank-1");
  podium.innerHTML += buildSpot(top3[2], "3", "rank-3");
}

function closeVictoryModal() {
  $("#victoryModal").classList.remove("active");
}

/* ----------------------------- CONFETTI ----------------------------- */
function triggerConfetti() {
  const duration = 3000;
  const end = Date.now() + duration;

  (function frame() {
    if (typeof confetti === "function") {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#6c5ce7', '#00b894', '#fdcb6e', '#e17055']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#6c5ce7', '#00b894', '#fdcb6e', '#e17055']
      });
    }

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

/* ------------------------------ AUDIO ENGINE ----------------------------- */
class AudioEngine {
  constructor() {
    this.enabled = true;
    this.audioContext = null;
    this.bgmSource = null;
    this.bgmAudio = null;
    this.currentMode = null;
    this.masterGain = null;
  }

  initContext() {
    if (this.audioContext) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.3;
    } catch(e) { console.warn("Web Audio API not supported"); }
  }

  toggle() {
    this.enabled = !this.enabled;
    ui.audioBtn.textContent = this.enabled ? "🔊" : "🔇";
    ui.audioBtn.classList.toggle("muted", !this.enabled);
    if (!this.enabled) {
      this.stopBgm();
      if (this.audioContext) this.audioContext.suspend();
    } else {
      if (this.audioContext) this.audioContext.resume();
      if (state.meta?.status === "playing") this.setMode("battle");
      else if (state.roomCode) this.setMode("lobby");
    }
  }

  setMode(mode) {
    if (!this.enabled) return;
    this.initContext();
    if (this.currentMode === mode) return;
    this.stopBgm();
    this.currentMode = mode;
    if (mode === "lobby" || mode === "battle") this._playSynthBgm(mode);
  }

  stopBgm() {
    if (this.bgmSource) {
      try { this.bgmSource.stop(); } catch(e){}
      this.bgmSource = null;
    }
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio = null;
    }
    this.currentMode = null;
  }

  playSfx(type) {
    if (!this.enabled) return;
    this.initContext();
    this._playSynthSfx(type);
  }

  _playSynthBgm(mode) {
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = mode === "battle" ? "sawtooth" : "triangle";
    osc.frequency.value = mode === "battle" ? 110 : 220;
    
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    this.bgmSource = osc;
  }

  _playSynthSfx(type) {
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    const now = ctx.currentTime;
    if (type === "correct") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === "wrong") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "hit") {
      osc.type = "square";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "victory") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.2);
      osc.frequency.setValueAtTime(783.99, now + 0.4);
      osc.frequency.setValueAtTime(1046.50, now + 0.6);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
      gain.gain.setValueAtTime(0.3, now + 1.0);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 2.0);
      osc.start(now);
      osc.stop(now + 2.0);
    } else {
      // click
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  }
}

const audioEngine = new AudioEngine();


/* --------------------------------- FIREBASE NETWORK ---------------------------------- */
const firebaseConfig = {
  "apiKey": "AIzaSyB7GEG6gSDRBxKFmuo0iG_wt-IsTaDyHWU",
  "authDomain": "test-aa50d.firebaseapp.com",
  "databaseURL": "https://test-aa50d-default-rtdb.firebaseio.com",
  "projectId": "test-aa50d",
  "storageBucket": "test-aa50d.firebasestorage.app",
  "messagingSenderId": "160629020295",
  "appId": "1:160629020295:web:f651d69adcffb025f68a22"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
let roomRef = null;

function initializeNetwork() {
  auth.signInAnonymously().then(() => {
    currentUser.uid = auth.currentUser.uid;
    setConnectionStatus(true, "Đã kết nối máy chủ Firebase");
  }).catch(e => {
    setConnectionStatus(false, "Lỗi kết nối");
    console.error(e);
  });
}

function setConnectionStatus(connected, text = "") {
  ui.connectionBadge.classList.toggle("online", connected);
  ui.connectionBadge.classList.toggle("offline", !connected);
  ui.connectionBadge.textContent = text || (connected ? "Đã kết nối" : "Chưa kết nối");
}

function getPlayerDamage(player) { return Number(player?.stats?.damage || 0); }
function getPlayerCombo(player) { return Number(player?.stats?.combo || 0); }

function getSortedPlayers() {
  return Object.entries(state.players || {})
    .filter(([, player]) => player?.profile?.name)
    .map(([uid, player]) => ({ uid, ...player }))
    .sort((a, b) => {
      const damageDiff = getPlayerDamage(b) - getPlayerDamage(a);
      if (damageDiff !== 0) return damageDiff;
      const correctDiff = Number(b.stats?.correct || 0) - Number(a.stats?.correct || 0);
      if (correctDiff !== 0) return correctDiff;
      return Number(a.profile?.joinedAt || 0) - Number(b.profile?.joinedAt || 0);
    });
}

function getTotalDamage() {
  return state.sortedPlayers.reduce((sum, player) => sum + getPlayerDamage(player), 0);
}

function getBossHp() {
  const maxHp = Number(state.meta?.maxBossHp || 1000);
  return Math.max(0, maxHp - getTotalDamage());
}

function getMyPlayer() { return state.players[currentUser.uid]; }
function isHost() { return Boolean(state.meta?.hostUid === currentUser.uid); }

async function updateRoomMeta(updates) {
  if (!isHost() || !state.roomCode) return false;
  await db.ref('rooms/' + state.roomCode + '/meta').update(updates);
  return true;
}

function generateRoomCode() {
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += ROOM_CODE_CHARACTERS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARACTERS.length));
  }
  return result;
}

function normalizeRoomCode(code) {
  return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function createRoom(e) {
  e.preventDefault();
  if(!currentUser.uid) { showToast("Đang chờ kết nối máy chủ...", "warning"); return; }
  
  const teacherName = ui.teacherNameInput.value.trim();
  const className = ui.classNameInput.value.trim();
  const bossType = ui.bossTypeInput.value;
  const bossHp = Number(ui.bossHpInput.value);

  if (!teacherName || !className || !bossHp) {
    showToast("Vui lòng điền đủ thông tin.", "warning");
    return;
  }

  setButtonLoading($("#createRoomForm button"), true);
  state.roomCode = generateRoomCode();
  
  state.role = "teacher";
  state.displayName = teacherName;
  
  const meta = {
    hostUid: currentUser.uid,
    teacherName, className, bossType, maxBossHp: bossHp,
    status: "waiting", roomLocked: false, createdAt: Date.now()
  };
  
  db.ref('rooms/' + state.roomCode + '/meta').set(meta).then(() => {
    setupRoomListener(state.roomCode);
    showScreen("room");
    audioEngine.setMode("lobby");
    showToast(`Phòng ${state.roomCode} đã tạo thành công!`, "success");
    setButtonLoading($("#createRoomForm button"), false);
  });
}

function joinRoom(e) {
  e.preventDefault();
  if(!currentUser.uid) { showToast("Đang chờ kết nối máy chủ...", "warning"); return; }
  
  const roomCode = normalizeRoomCode(ui.roomCodeInput.value);
  const studentName = ui.studentNameInput.value.trim();

  if (roomCode.length !== 6 || !studentName) {
    showToast("Vui lòng điền đủ thông tin.", "warning");
    return;
  }

  setButtonLoading($("#joinRoomForm button"), true);
  
  db.ref('rooms/' + roomCode + '/meta').once('value').then(snap => {
    const meta = snap.val();
    if (!meta) {
      showToast("Phòng không tồn tại.", "error");
      setButtonLoading($("#joinRoomForm button"), false);
      return;
    }
    if (meta.roomLocked || meta.status === "finished") {
      showToast("Phòng đang khóa hoặc đã kết thúc.", "error");
      setButtonLoading($("#joinRoomForm button"), false);
      return;
    }
    
    state.role = "student";
    state.roomCode = roomCode;
    state.displayName = studentName;
    
    const avatars = ["avatar_1.png", "avatar_2.png", "avatar_3.png", "avatar_4.png", "avatar_5.png", "avatar_6.png", "avatar_7.png", "avatar_8.png"];
    const randomAvatar = "assets/avatars/" + avatars[Math.floor(Math.random() * avatars.length)];
    
    const pRef = db.ref('rooms/' + roomCode + '/players/' + currentUser.uid);
    pRef.set({
      profile: { name: studentName, avatar: randomAvatar, joinedAt: Date.now() },
      stats: { damage: 0, combo: 0, correct: 0, wrong: 0 }
    }).then(() => {
      pRef.onDisconnect().remove();
      setupRoomListener(roomCode);
      setButtonLoading($("#joinRoomForm button"), false);
      showScreen("room");
      audioEngine.setMode("lobby");
    });
  });
}

function setupRoomListener(roomCode) {
  if(roomRef) roomRef.off();
  roomRef = db.ref('rooms/' + roomCode);
  roomRef.on('value', snap => {
    const data = snap.val();
    if (!data) {
      showToast("Phòng đã bị đóng.", "error");
      leaveRoom();
      return;
    }
    state.meta = data.meta || {};
    state.players = data.players || {};
    
    if (state.meta.status === "playing" && audioEngine.currentMode !== "battle") audioEngine.setMode("battle");
    if ((state.meta.status === "waiting" || state.meta.status === "finished" || state.meta.status === "failed") && audioEngine.currentMode !== "lobby") audioEngine.setMode("lobby");
    
    syncUI();
  });
}

function leaveRoom(manual = false) {
  if (roomRef) roomRef.off();
  if (state.roomCode) {
    if (isHost()) {
      db.ref('rooms/' + state.roomCode).remove();
    } else {
      db.ref('rooms/' + state.roomCode + '/players/' + currentUser.uid).remove();
    }
  }
  
  roomRef = null;
  state.roomCode = null;
  state.role = null;
  state.meta = null;
  state.players = {};
  
  resetQuizState();
  audioEngine.stopBgm();
  
  if (manual) showToast("Đã rời phòng.");
  showScreen("home");
}

/* ------------------------------ GAME CONTROLS ------------------------------ */
async function startGame() {
  if (getBossHp() <= 0) {
    showToast("Boss đã bị hạ gục. Vui lòng thiết lập lại trận đấu.", "warning");
    return;
  }
  await updateRoomMeta({ 
    status: "playing",
    startTime: Date.now(),
    durationMs: 10 * 60 * 1000
  });
  showToast("Trận đấu bắt đầu!");
}

async function pauseGame() {
  await updateRoomMeta({ status: "paused" });
  showToast("Đã tạm dừng trận đấu.");
}

async function endGame() {
  await updateRoomMeta({ status: "finished" });
  showToast("Đã kết thúc trò chơi.");
}

async function resetGame() {
  if (!isHost()) return;
  ui.resetGameBtn.disabled = true;
  await db.ref('rooms/' + state.roomCode + '/players').remove(); // clear players
  await updateRoomMeta({ status: "waiting" });
  audioEngine.setMode("lobby");
  showToast("Đã đặt lại trận đấu. Mọi học sinh cần vào lại phòng.", "success");
  ui.resetGameBtn.disabled = false;
}

async function toggleRoomLock() {
  const success = await updateRoomMeta({ roomLocked: ui.lockRoomToggle.checked });
  if (success) showToast(ui.lockRoomToggle.checked ? "Đã khóa phòng." : "Đã mở khóa phòng.");
}

/* ------------------------------ QUIZ / ATTACK ---------------------------- */
function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

function nextQuestion() {
  if (state.meta?.status !== "playing" || getBossHp() <= 0) return;
  
  const QUESTION_BANK = window.QUESTION_BANK;
  let next = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
  if (QUESTION_BANK.length > 1) {
    while (next === currentQuestion) next = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
  }
  currentQuestion = next;
  questionNumber++;
  answerLocked = false;
  renderQuestion();
}

function renderQuestion() {
  if (!currentQuestion) return;
  ui.questionCategory.textContent = currentQuestion.category;
  ui.questionCounter.textContent = `Câu ${questionNumber}`;
  ui.questionText.textContent = currentQuestion.question;
  ui.answerFeedback.textContent = "";
  ui.answerFeedback.className = "answer-feedback";
  ui.answerGrid.innerHTML = "";

  currentQuestion.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.innerHTML = `<strong>${String.fromCharCode(65 + index)}.</strong> ${escapeHtml(answer)}`;
    button.addEventListener("click", () => submitAnswer(index, button));
    ui.answerGrid.appendChild(button);
  });
}

function resetQuizState() {
  currentQuestion = null;
  questionNumber = 0;
  answerLocked = false;
  victoryShown = false;
  finishingRoom = false;
  previousTotalDamage = 0;
}

async function submitAnswer(selectedIndex, selectedButton) {
  if (answerLocked || !currentQuestion || state.meta?.status !== "playing" || getBossHp() <= 0) return;

  answerLocked = true;
  const buttons = $$(".answer-button");
  buttons.forEach((button) => { button.disabled = true; });

  const isCorrect = selectedIndex === currentQuestion.correctIndex;
  const correctButton = buttons[currentQuestion.correctIndex];
  if (correctButton) correctButton.classList.add("correct");
  if (!isCorrect) selectedButton.classList.add("wrong");

  const myPlayer = getMyPlayer();
  const oldCombo = getPlayerCombo(myPlayer);
  const newCombo = isCorrect ? oldCombo + 1 : 0;
  const critical = isCorrect && Math.random() < Math.min(0.1 + newCombo * 0.015, 0.22);

  const baseDamage = 20 + Math.min(newCombo, 5) * 5;
  const damage = isCorrect ? Math.min(60, critical ? baseDamage + 20 : baseDamage) : 0;

  ui.answerFeedback.innerHTML = isCorrect
    ? (critical ? `<strong>CRITICAL!</strong> Chính xác — gây ${damage} sát thương!<br/><small>${escapeHtml(currentQuestion.explanation || '')}</small>` : `Chính xác — gây ${damage} sát thương!<br/><small>${escapeHtml(currentQuestion.explanation || '')}</small>`)
    : `Chưa đúng. Đáp án là: <strong>${escapeHtml(currentQuestion.answers[currentQuestion.correctIndex])}</strong><br/><small>${escapeHtml(currentQuestion.explanation || '')}</small>`;
  ui.answerFeedback.classList.add(isCorrect ? "good" : "bad");

  // Gửi sát thương lên Firebase
  if (state.roomCode) {
    db.ref('rooms/' + state.roomCode + '/players/' + currentUser.uid + '/stats').transaction(stats => {
      if (stats) {
        stats.damage += damage;
        stats.combo = newCombo;
        if (isCorrect) stats.correct++;
        else stats.wrong++;
      }
      return stats;
    });
  }

  if (isCorrect) {
    audioEngine.playSfx("correct");
    if (critical) audioEngine.playSfx("hit");
  } else {
    audioEngine.playSfx("wrong");
  }

  setTimeout(() => {
    if (state.meta?.status === "playing" && getBossHp() > 0) nextQuestion();
  }, NEXT_QUESTION_DELAY_MS);
}
/* ------------------------------- SHARE --------------------------------- */
function copyRoomCode() {
  navigator.clipboard.writeText(state.roomCode).then(() => showToast("Đã copy mã phòng!"));
}

function copyInviteLink() {
  const url = new URL(window.location.href);
  url.searchParams.set("room", state.roomCode);
  navigator.clipboard.writeText(url.toString()).then(() => showToast("Đã copy link mời!"));
}

/* ------------------------------- EVENTS --------------------------------- */
function bindEvents() {
  $("#homeBtn").addEventListener("click", () => {
    if (state.roomCode) { showToast("Hãy bấm “Rời phòng” trước.", "warning"); return; }
    showScreen("home");
  });

  $("#goTeacherBtn").addEventListener("click", () => showScreen("teacherSetup"));
  $("#goStudentBtn").addEventListener("click", () => showScreen("studentJoin"));
  $$(".back-home").forEach((button) => button.addEventListener("click", () => showScreen("home")));
  
  $("#createRoomForm").addEventListener("submit", createRoom);
  $("#joinRoomForm").addEventListener("submit", joinRoom);
  $("#leaveRoomBtn").addEventListener("click", () => leaveRoom(true));
  $("#copyCodeBtn").addEventListener("click", copyRoomCode);
  $("#copyLinkBtn").addEventListener("click", copyInviteLink);
  
  ui.startGameBtn.addEventListener("click", startGame);
  ui.pauseGameBtn.addEventListener("click", pauseGame);
  ui.resetGameBtn.addEventListener("click", resetGame);
  ui.endGameBtn.addEventListener("click", endGame);
  ui.lockRoomToggle.addEventListener("change", toggleRoomLock);
  ui.audioBtn.addEventListener("click", () => {
    audioEngine.toggle();
    audioEngine.playSfx("click");
  });
  $("#closeVictoryBtn").addEventListener("click", closeVictoryModal);

  ui.roomCodeInput.addEventListener("input", () => {
    ui.roomCodeInput.value = normalizeRoomCode(ui.roomCodeInput.value);
  });
}

/* -------------------------------- BOOT ---------------------------------- */
bindEvents();
initializeNetwork();
