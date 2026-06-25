import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
  onDisconnect,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import { QUESTION_BANK } from "./questions.js";

/* --------------------------------------------------------------------------
   1) FIREBASE CONFIG
   Firebase Console > Project settings > Your apps > Web app > SDK setup
   Thay toàn bộ giá trị bên dưới bằng config thật của dự án.
---------------------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyB7GEG6gSDRBxKFmuo0iG_wt-IsTaDyHWU",
  authDomain: "test-aa50d.firebaseapp.com",
  databaseURL: "https://test-aa50d-default-rtdb.firebaseio.com",
  projectId: "test-aa50d",
  storageBucket: "test-aa50d.firebasestorage.app",
  messagingSenderId: "160629020295",
  appId: "1:160629020295:web:f651d69adcffb025f68a22"
};

/* --------------------------------------------------------------------------
   2) OPTIONAL GENERATED AUDIO
   - false: dùng nhạc/SFX tổng hợp bằng Web Audio API, chạy ngay không cần file.
   - true: ưu tiên file trong assets/audio/. Nếu file lỗi, tự quay về âm thanh tổng hợp.
---------------------------------------------------------------------------- */
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
  dragon: {
    name: "Rồng Lửa",
    image: "assets/boss-dragon.png",
    fallback: "🐲"
  },
  robot: {
    name: "Robot Khổng Lồ",
    image: "assets/boss-robot.png",
    fallback: "🤖"
  },
  slime: {
    name: "Slime Vũ Trụ",
    image: "assets/boss-slime.png",
    fallback: "👾"
  }
};

const APP_SESSION_KEY = "classBossBattleSessionV1";
const ROOM_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ANSWER_LOCK_MS = 900;
const NEXT_QUESTION_DELAY_MS = 950;

let app = null;
let auth = null;
let db = null;
let currentUser = null;
let unsubMeta = null;
let unsubPlayers = null;
let currentQuestion = null;
let questionNumber = 0;
let answerLocked = false;
let victoryShown = false;
let finishingRoom = false;
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
  configWarning: $("#configWarning"),
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
  myRankDisplay: $("#myRankDisplay"),
  onlineCount: $("#onlineCount"),
  leaderboardList: $("#leaderboardList"),
  victoryModal: $("#victoryModal"),
  victorySubtitle: $("#victorySubtitle"),
  podium: $("#podium"),
  toastContainer: $("#toastContainer")
};

/* ------------------------------ AUDIO ENGINE ----------------------------- */
class AudioEngine {
  constructor() {
    this.enabled = false;
    this.context = null;
    this.bgmTimer = null;
    this.bgmMode = "lobby";
    this.fileBgm = null;
    this.fileSfx = new Map();
  }

  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      await this.ensureContext();
      this.playSfx("click");
      this.startBgm(this.bgmMode);
    } else {
      this.stopBgm();
    }
    ui.audioBtn.textContent = this.enabled ? "🔊" : "🔇";
    ui.audioBtn.title = this.enabled ? "Tắt âm thanh" : "Bật âm thanh";
  }

  async ensureContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.context = new AudioContextClass();
        const mainGain = this.context.createGain();
        mainGain.gain.value = 0.6;
        mainGain.connect(this.context.destination);
        this.mainOut = mainGain;
      }
    }
    if (this.context?.state === "suspended") await this.context.resume();
  }

  setMode(mode) {
    this.bgmMode = mode === "playing" ? "battle" : "lobby";
    if (this.enabled) this.startBgm(this.bgmMode);
  }

  startBgm(mode = "lobby") {
    this.stopBgm();
    if (!this.enabled) return;

    if (USE_GENERATED_AUDIO) {
      const audio = new Audio(GENERATED_AUDIO[mode]);
      audio.loop = true;
      audio.volume = mode === "battle" ? 0.22 : 0.16;
      audio.play().then(() => {
        this.fileBgm = audio;
      }).catch(() => this.startSynthBgm(mode));
      return;
    }

    this.startSynthBgm(mode);
  }

  startSynthBgm(mode) {
    if (!this.context) return;
    const notes = mode === "battle"
      ? [220, 261.63, 329.63, 293.66, 246.94, 293.66, 349.23, 329.63]
      : [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
    let index = 0;

    const tick = () => {
      if (!this.enabled || !this.context) return;
      const base = notes[index % notes.length];
      
      // Melody
      this.tone(base, mode === "battle" ? 0.15 : 0.2, 0.08, "square");
      
      // Bass line
      if (index % 2 === 0) {
         this.tone(base / 2, 0.2, 0.1, "sawtooth", 1000); 
      }
      
      // Harmony
      if (mode === "battle") {
         this.tone(base * 1.5, 0.1, 0.05, "triangle");
      }
      index += 1;
    };

    tick();
    this.bgmTimer = window.setInterval(tick, mode === "battle" ? 260 : 400);
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.fileBgm) {
      this.fileBgm.pause();
      this.fileBgm.currentTime = 0;
      this.fileBgm = null;
    }
  }

  playSfx(name) {
    if (!this.enabled) return;

    if (USE_GENERATED_AUDIO) {
      const audio = new Audio(GENERATED_AUDIO[name]);
      audio.volume = name === "victory" ? 0.45 : 0.34;
      audio.play().catch(() => this.playSynthSfx(name));
      return;
    }

    this.playSynthSfx(name);
  }

  playSynthSfx(name) {
    if (!this.context) return;
    const patterns = {
      click: [[520, 0.04, 0.06, "sine"]],
      hit: [[110, 0.08, 0.2, "square", 500], [85, 0.06, 0.16, "sawtooth", 400]],
      correct: [[523.25, 0.08, 0.15, "sine"], [659.25, 0.1, 0.18, "sine"], [783.99, 0.15, 0.2, "triangle"]],
      wrong: [[220, 0.1, 0.18, "sawtooth", 800], [174.61, 0.14, 0.2, "sawtooth", 600]],
      victory: [[523.25, 0.12, 0.2, "triangle"], [659.25, 0.12, 0.2, "triangle"], [783.99, 0.15, 0.24, "triangle"], [1046.5, 0.3, 0.28, "square", 2000]]
    };

    const sequence = patterns[name] || patterns.click;
    let delay = 0;
    sequence.forEach(([frequency, duration, volume, wave, filterFreq]) => {
      window.setTimeout(() => this.tone(frequency, duration, volume, wave, filterFreq), delay);
      delay += duration * 750;
    });
  }

  tone(frequency, duration, volume = 0.12, wave = "sine", filterFreq = null) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.001), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    
    if (filterFreq) {
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(filterFreq, now);
      filter.frequency.exponentialRampToValueAtTime(filterFreq / 4, now + duration);
      oscillator.connect(filter);
      filter.connect(gain);
    } else {
      oscillator.connect(gain);
    }
    
    gain.connect(this.mainOut || this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }
}

const audioEngine = new AudioEngine();

/* ------------------------------- UTILITIES ------------------------------- */
function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes("YOUR_") &&
    firebaseConfig.projectId &&
    !firebaseConfig.projectId.includes("YOUR_") &&
    firebaseConfig.databaseURL &&
    !firebaseConfig.databaseURL.includes("YOUR_")
  );
}

function sanitizeName(value, maxLength = 30) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeRoomCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function generateRoomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ROOM_CODE_CHARACTERS[Math.floor(Math.random() * ROOM_CODE_CHARACTERS.length)];
  }
  return code;
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showScreen(screenName) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[screenName]?.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message, type = "default") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  ui.toastContainer.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

function setConnectionStatus(connected, text = "") {
  ui.connectionBadge.classList.toggle("online", connected);
  ui.connectionBadge.classList.toggle("offline", !connected);
  ui.connectionBadge.textContent = text || (connected ? "Đã kết nối" : "Chưa kết nối");
}

function saveSession() {
  if (!state.roomCode || !state.role) return;
  localStorage.setItem(APP_SESSION_KEY, JSON.stringify({
    role: state.role,
    roomCode: state.roomCode,
    displayName: state.displayName
  }));
}

function clearSession() {
  localStorage.removeItem(APP_SESSION_KEY);
}

function getSavedSession() {
  try {
    return JSON.parse(localStorage.getItem(APP_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function setButtonLoading(button, loading, loadingText = "Đang xử lý...") {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function getPlayerDamage(player) {
  return Number(player?.stats?.damage || 0);
}

function getPlayerCombo(player) {
  return Number(player?.stats?.combo || 0);
}

function getSortedPlayers(playersObject = state.players) {
  return Object.entries(playersObject || {})
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

function getMyPlayer() {
  return currentUser ? state.players[currentUser.uid] : null;
}

function isHost() {
  return Boolean(currentUser && state.meta?.hostUid === currentUser.uid);
}

function requireFirebase() {
  if (!isFirebaseConfigured() || !db || !currentUser) {
    showToast("Hãy cấu hình Firebase và chờ kết nối trước.", "error");
    return false;
  }
  return true;
}

/* ---------------------------- FIREBASE STARTUP --------------------------- */
async function initializeFirebase() {
  if (!isFirebaseConfigured()) {
    ui.configWarning.classList.remove("hidden");
    setConnectionStatus(false, "Chưa cấu hình");
    return;
  }

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    await setPersistence(auth, browserLocalPersistence);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        setConnectionStatus(true, "Firebase online");
        await tryRestoreSession();
      } else {
        currentUser = null;
        setConnectionStatus(false, "Đang đăng nhập...");
      }
    });

    await signInAnonymously(auth);
  } catch (error) {
    console.error("Firebase initialization error:", error);
    setConnectionStatus(false, "Lỗi Firebase");
    showToast(`Không thể kết nối Firebase: ${friendlyFirebaseError(error)}`, "error");
  }
}

function friendlyFirebaseError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/operation-not-allowed": "Bạn chưa bật Anonymous Authentication.",
    "auth/configuration-not-found": "Authentication chưa được cấu hình.",
    "database/permission-denied": "Database Rules đang từ chối thao tác.",
    "PERMISSION_DENIED": "Database Rules đang từ chối thao tác."
  };
  return messages[code] || error?.message || "Lỗi không xác định";
}

async function tryRestoreSession() {
  const saved = getSavedSession();
  if (!saved?.roomCode || !saved?.role || state.roomCode) return;

  try {
    const metaSnapshot = await get(ref(db, `rooms/${saved.roomCode}/meta`));
    if (!metaSnapshot.exists()) {
      clearSession();
      return;
    }

    const meta = metaSnapshot.val();
    if (saved.role === "teacher" && meta.hostUid !== currentUser.uid) {
      clearSession();
      return;
    }

    if (saved.role === "student") {
      const profileSnapshot = await get(ref(db, `rooms/${saved.roomCode}/players/${currentUser.uid}/profile`));
      if (!profileSnapshot.exists()) {
        clearSession();
        return;
      }
    }

    await enterRoom(saved.roomCode, saved.role, saved.displayName, true);
    showToast("Đã khôi phục phiên chơi trước.", "success");
  } catch (error) {
    console.warn("Could not restore session:", error);
  }
}

/* ------------------------------ ROOM CREATE ------------------------------ */
async function createRoom(event) {
  event.preventDefault();
  if (!requireFirebase()) return;

  const teacherName = sanitizeName(ui.teacherNameInput.value, 30);
  const className = sanitizeName(ui.classNameInput.value, 40);
  const bossType = ui.bossTypeInput.value;
  const maxBossHp = Number(ui.bossHpInput.value);
  const submitButton = event.submitter;

  if (!teacherName || !className) {
    showToast("Vui lòng nhập tên giáo viên và tên lớp.", "warning");
    return;
  }

  setButtonLoading(submitButton, true, "Đang tạo phòng...");

  try {
    let roomCode = null;
    let attempts = 0;

    while (!roomCode && attempts < 8) {
      attempts += 1;
      const candidate = generateRoomCode();
      const metaRef = ref(db, `rooms/${candidate}/meta`);
      const result = await runTransaction(metaRef, (currentMeta) => {
        if (currentMeta !== null) return;
        return {
          hostUid: currentUser.uid,
          teacherName,
          className,
          bossType,
          bossName: BOSS_CONFIG[bossType]?.name || "Boss",
          maxBossHp,
          status: "lobby",
          roomLocked: false,
          createdAt: Date.now(),
          startedAt: 0,
          endedAt: 0,
          hostOnline: true
        };
      }, { applyLocally: false });

      if (result.committed) roomCode = candidate;
    }

    if (!roomCode) throw new Error("Không thể tạo mã phòng duy nhất. Hãy thử lại.");

    const hostPresenceRef = ref(db, `rooms/${roomCode}/meta/hostOnline`);
    await onDisconnect(hostPresenceRef).set(false);
    await set(hostPresenceRef, true);

    await enterRoom(roomCode, "teacher", teacherName);
    audioEngine.playSfx("correct");
    showToast(`Đã tạo phòng ${roomCode}.`, "success");
  } catch (error) {
    console.error("Create room error:", error);
    showToast(friendlyFirebaseError(error), "error");
  } finally {
    setButtonLoading(submitButton, false);
  }
}

/* ------------------------------- ROOM JOIN ------------------------------- */
async function joinRoom(event) {
  event.preventDefault();
  if (!requireFirebase()) return;

  const roomCode = normalizeRoomCode(ui.roomCodeInput.value);
  const studentName = sanitizeName(ui.studentNameInput.value, 24);
  const submitButton = event.submitter;

  if (roomCode.length !== 6) {
    showToast("Mã phòng phải có đúng 6 ký tự.", "warning");
    return;
  }
  if (studentName.length < 2) {
    showToast("Tên học sinh cần có ít nhất 2 ký tự.", "warning");
    return;
  }

  setButtonLoading(submitButton, true, "Đang vào phòng...");

  try {
    const metaSnapshot = await get(ref(db, `rooms/${roomCode}/meta`));
    if (!metaSnapshot.exists()) throw new Error("Không tìm thấy phòng này.");

    const meta = metaSnapshot.val();
    if (meta.roomLocked) throw new Error("Phòng đang khóa, không thể tham gia mới.");
    if (meta.status === "finished") throw new Error("Trận đấu đã kết thúc.");

    const profileRef = ref(db, `rooms/${roomCode}/players/${currentUser.uid}/profile`);
    const profileSnapshot = await get(profileRef);

    if (!profileSnapshot.exists()) {
      await set(profileRef, {
        name: studentName,
        joinedAt: Date.now(),
        avatar: Math.floor(Math.random() * 8)
      });
    }

    const statsRef = ref(db, `rooms/${roomCode}/players/${currentUser.uid}/stats`);
    const statsSnapshot = await get(statsRef);
    if (!statsSnapshot.exists()) {
      await set(statsRef, {
        damage: 0,
        correct: 0,
        wrong: 0,
        combo: 0,
        bestCombo: 0,
        lastAttackAt: 0
      });
    }

    const presenceRef = ref(db, `rooms/${roomCode}/players/${currentUser.uid}/presence`);
    await onDisconnect(presenceRef).set({
      online: false,
      lastSeen: serverTimestamp()
    });
    await set(presenceRef, {
      online: true,
      lastSeen: serverTimestamp()
    });

    await enterRoom(roomCode, "student", studentName);
    audioEngine.playSfx("correct");
    showToast(`Đã vào phòng ${roomCode}.`, "success");
  } catch (error) {
    console.error("Join room error:", error);
    showToast(friendlyFirebaseError(error), "error");
  } finally {
    setButtonLoading(submitButton, false);
  }
}

async function enterRoom(roomCode, role, displayName, restoring = false) {
  detachRoomListeners();

  state.role = role;
  state.roomCode = roomCode;
  state.displayName = displayName;
  state.meta = null;
  state.players = {};
  state.sortedPlayers = [];
  previousTotalDamage = 0;
  victoryShown = false;
  finishingRoom = false;
  answerLocked = false;
  questionNumber = 0;

  saveSession();
  showScreen("room");

  ui.roleLabel.textContent = role === "teacher" ? "GIAO DIỆN GIÁO VIÊN" : "GIAO DIỆN HỌC SINH";
  ui.roomCodeDisplay.textContent = roomCode;
  ui.teacherControls.classList.toggle("hidden", role !== "teacher");
  ui.studentGamePanel.classList.toggle("hidden", role !== "student");

  unsubMeta = onValue(ref(db, `rooms/${roomCode}/meta`), (snapshot) => {
    if (!snapshot.exists()) {
      showToast("Phòng đã bị xóa hoặc không còn tồn tại.", "error");
      leaveRoom(false);
      return;
    }
    state.meta = snapshot.val();
    renderMeta();
    renderBattle();
    renderStudentPanel();
  }, (error) => {
    showToast(friendlyFirebaseError(error), "error");
  });

  unsubPlayers = onValue(ref(db, `rooms/${roomCode}/players`), (snapshot) => {
    state.players = snapshot.val() || {};
    state.sortedPlayers = getSortedPlayers();
    renderLeaderboard();
    renderBattle();
    renderStudentStats();
  }, (error) => {
    showToast(friendlyFirebaseError(error), "error");
  });

  if (role === "student") {
    const presenceRef = ref(db, `rooms/${roomCode}/players/${currentUser.uid}/presence`);
    await onDisconnect(presenceRef).set({ online: false, lastSeen: serverTimestamp() });
    await update(presenceRef, { online: true, lastSeen: serverTimestamp() });
  } else if (role === "teacher") {
    const hostOnlineRef = ref(db, `rooms/${roomCode}/meta/hostOnline`);
    await onDisconnect(hostOnlineRef).set(false);
    await set(hostOnlineRef, true);
  }

  if (!restoring) audioEngine.setMode("lobby");
}

function detachRoomListeners() {
  if (typeof unsubMeta === "function") unsubMeta();
  if (typeof unsubPlayers === "function") unsubPlayers();
  unsubMeta = null;
  unsubPlayers = null;
}

async function leaveRoom(showMessage = true) {
  try {
    if (db && currentUser && state.roomCode) {
      if (state.role === "student") {
        await update(ref(db, `rooms/${state.roomCode}/players/${currentUser.uid}/presence`), {
          online: false,
          lastSeen: serverTimestamp()
        });
      } else if (state.role === "teacher" && isHost()) {
        await set(ref(db, `rooms/${state.roomCode}/meta/hostOnline`), false);
      }
    }
  } catch (error) {
    console.warn("Leave presence update failed:", error);
  }

  detachRoomListeners();
  clearSession();
  state.role = null;
  state.roomCode = null;
  state.displayName = null;
  state.meta = null;
  state.players = {};
  state.sortedPlayers = [];
  closeVictoryModal();
  audioEngine.setMode("lobby");
  showScreen("home");
  if (showMessage) showToast("Đã rời phòng.");
}

/* ----------------------------- HOST CONTROLS ----------------------------- */
async function updateRoomMeta(patch) {
  if (!requireFirebase() || !state.roomCode || !isHost()) {
    showToast("Chỉ giáo viên tạo phòng mới có quyền điều khiển.", "error");
    return false;
  }

  try {
    await update(ref(db, `rooms/${state.roomCode}/meta`), patch);
    return true;
  } catch (error) {
    showToast(friendlyFirebaseError(error), "error");
    return false;
  }
}

async function startGame() {
  if (state.sortedPlayers.length === 0) {
    showToast("Cần ít nhất một học sinh trong phòng.", "warning");
    return;
  }
  const success = await updateRoomMeta({
    status: "playing",
    startedAt: serverTimestamp(),
    endedAt: 0
  });
  if (success) {
    victoryShown = false;
    closeVictoryModal();
    audioEngine.playSfx("click");
    showToast("Trận đấu bắt đầu!", "success");
  }
}

async function pauseGame() {
  const nextStatus = state.meta?.status === "paused" ? "playing" : "paused";
  const success = await updateRoomMeta({ status: nextStatus });
  if (success) showToast(nextStatus === "paused" ? "Đã tạm dừng trận đấu." : "Đã tiếp tục trận đấu.");
}

async function endGame() {
  const success = await updateRoomMeta({
    status: "finished",
    endedAt: serverTimestamp()
  });
  if (success) {
    audioEngine.playSfx("victory");
    showToast("Đã kết thúc trận đấu.", "success");
  }
}

async function resetGame() {
  if (!requireFirebase() || !state.roomCode || !isHost()) return;

  try {
    ui.resetGameBtn.disabled = true;
    const updates = {};

    state.sortedPlayers.forEach((player) => {
      updates[`rooms/${state.roomCode}/players/${player.uid}/stats`] = {
        damage: 0,
        correct: 0,
        wrong: 0,
        combo: 0,
        bestCombo: 0,
        lastAttackAt: 0
      };
    });

    updates[`rooms/${state.roomCode}/meta/status`] = "lobby";
    updates[`rooms/${state.roomCode}/meta/startedAt`] = 0;
    updates[`rooms/${state.roomCode}/meta/endedAt`] = 0;

    await update(ref(db), updates);
    victoryShown = false;
    finishingRoom = false;
    closeVictoryModal();
    audioEngine.setMode("lobby");
    showToast("Đã đặt lại trận đấu. Điểm của mọi học sinh về 0.", "success");
  } catch (error) {
    showToast(friendlyFirebaseError(error), "error");
  } finally {
    ui.resetGameBtn.disabled = false;
  }
}

async function toggleRoomLock() {
  const success = await updateRoomMeta({ roomLocked: ui.lockRoomToggle.checked });
  if (success) showToast(ui.lockRoomToggle.checked ? "Đã khóa phòng." : "Đã mở khóa phòng.");
}

async function finishRoomIfNeeded() {
  if (
    finishingRoom ||
    !isHost() ||
    state.meta?.status !== "playing" ||
    getBossHp() > 0
  ) return;

  finishingRoom = true;
  try {
    await updateRoomMeta({
      status: "finished",
      endedAt: serverTimestamp()
    });
  } finally {
    finishingRoom = false;
  }
}

/* ------------------------------ QUIZ / ATTACK ---------------------------- */
function nextQuestion() {
  if (state.meta?.status !== "playing" || getBossHp() <= 0) return;

  let next = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
  if (QUESTION_BANK.length > 1) {
    while (next === currentQuestion) {
      next = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
    }
  }

  currentQuestion = next;
  questionNumber += 1;
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

async function submitAnswer(selectedIndex, selectedButton) {
  if (
    answerLocked ||
    !currentQuestion ||
    state.meta?.status !== "playing" ||
    getBossHp() <= 0 ||
    !requireFirebase()
  ) return;

  answerLocked = true;
  const buttons = $$(".answer-button");
  buttons.forEach((button) => { button.disabled = true; });

  const isCorrect = selectedIndex === currentQuestion.correctIndex;
  const correctButton = buttons[currentQuestion.correctIndex];
  correctButton?.classList.add("correct");
  if (!isCorrect) selectedButton.classList.add("wrong");

  const myPlayer = getMyPlayer();
  const oldCombo = getPlayerCombo(myPlayer);
  const newCombo = isCorrect ? oldCombo + 1 : 0;
  const critical = isCorrect && Math.random() < Math.min(0.1 + newCombo * 0.015, 0.22);
  const baseDamage = 20 + Math.min(newCombo, 5) * 5;
  const damage = isCorrect ? Math.min(60, critical ? baseDamage + 20 : baseDamage) : 0;

  ui.answerFeedback.innerHTML = isCorrect
    ? (critical ? \`<strong>CRITICAL!</strong> Chính xác — gây ${damage} sát thương!<br/><small>${escapeHtml(currentQuestion.explanation || '')}</small>\` : \`Chính xác — gây ${damage} sát thương!<br/><small>${escapeHtml(currentQuestion.explanation || '')}</small>\`)
    : \`Chưa đúng. Đáp án là: <strong>${escapeHtml(currentQuestion.answers[currentQuestion.correctIndex])}</strong><br/><small>${escapeHtml(currentQuestion.explanation || '')}</small>\`;
  ui.answerFeedback.classList.add(isCorrect ? "good" : "bad");

  try {
    const statsRef = ref(db, `rooms/${state.roomCode}/players/${currentUser.uid}/stats`);
    const transactionResult = await runTransaction(statsRef, (stats) => {
      const current = stats || {
        damage: 0,
        correct: 0,
        wrong: 0,
        combo: 0,
        bestCombo: 0,
        lastAttackAt: 0
      };

      const now = Date.now();
      if (now - Number(current.lastAttackAt || 0) < ANSWER_LOCK_MS - 100) return;

      if (isCorrect) {
        const combo = Number(current.combo || 0) + 1;
        return {
          damage: Number(current.damage || 0) + damage,
          correct: Number(current.correct || 0) + 1,
          wrong: Number(current.wrong || 0),
          combo,
          bestCombo: Math.max(Number(current.bestCombo || 0), combo),
          lastAttackAt: now
        };
      }

      return {
        damage: Number(current.damage || 0),
        correct: Number(current.correct || 0),
        wrong: Number(current.wrong || 0) + 1,
        combo: 0,
        bestCombo: Number(current.bestCombo || 0),
        lastAttackAt: now
      };
    });

    if (!transactionResult.committed) {
      showToast("Thao tác quá nhanh. Hãy thử câu tiếp theo.", "warning");
    } else if (isCorrect) {
      audioEngine.playSfx("correct");
      audioEngine.playSfx("hit");
      animateBossHit(damage, critical);
    } else {
      audioEngine.playSfx("wrong");
    }
  } catch (error) {
    console.error("Submit answer error:", error);
    showToast(friendlyFirebaseError(error), "error");
  }

  window.setTimeout(() => {
    if (state.meta?.status === "playing" && getBossHp() > 0) nextQuestion();
  }, NEXT_QUESTION_DELAY_MS);
}

function animateBossHit(damage, critical = false) {
  ui.bossImage.classList.remove("hit");
  void ui.bossImage.offsetWidth;
  ui.bossImage.classList.add("hit");

  const number = document.createElement("div");
  number.className = `damage-number${critical ? " critical" : ""}`;
  number.textContent = `-${damage}`;
  number.style.left = `${45 + Math.random() * 15}%`;
  number.style.top = `${34 + Math.random() * 15}%`;
  ui.damageFloatLayer.appendChild(number);
  window.setTimeout(() => number.remove(), 1000);
}

/* -------------------------------- RENDER -------------------------------- */
function renderMeta() {
  if (!state.meta) return;

  const boss = BOSS_CONFIG[state.meta.bossType] || BOSS_CONFIG.dragon;
  ui.roomClassName.textContent = state.meta.className || "Lớp học";
  ui.roomTeacherName.textContent = `Giáo viên: ${state.meta.teacherName || "—"}`;
  ui.bossNameDisplay.textContent = state.meta.bossName || boss.name;
  ui.bossImage.src = boss.image;
  ui.bossImage.alt = state.meta.bossName || boss.name;
  ui.bossImage.onerror = () => {
    ui.bossImage.onerror = null;
    ui.bossImage.removeAttribute("src");
    ui.bossImage.alt = boss.fallback;
  };
  ui.lockRoomToggle.checked = Boolean(state.meta.roomLocked);

  const status = state.meta.status || "lobby";
  const statusText = {
    lobby: "Đang chờ",
    playing: "Đang chiến đấu",
    paused: "Tạm dừng",
    finished: "Đã kết thúc"
  }[status] || status;

  ui.gameStatusPill.textContent = statusText;
  ui.gameStatusPill.className = `game-status ${status}`;
  ui.pauseGameBtn.textContent = status === "paused" ? "▶ Tiếp tục" : "⏸ Tạm dừng";
  ui.startGameBtn.disabled = status === "playing" || status === "paused" || getBossHp() <= 0;
  ui.pauseGameBtn.disabled = !["playing", "paused"].includes(status);
  ui.endGameBtn.disabled = status === "finished";

  audioEngine.setMode(status);
}

function renderBattle() {
  if (!state.meta) return;

  const totalDamage = getTotalDamage();
  const maxHp = Number(state.meta.maxBossHp || 1000);
  const currentHp = Math.max(0, maxHp - totalDamage);
  const hpPercent = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));

  ui.totalDamageDisplay.textContent = formatNumber(totalDamage);
  ui.bossHpCurrent.textContent = formatNumber(currentHp);
  ui.bossHpMax.textContent = formatNumber(maxHp);
  ui.bossHpBar.style.width = `${hpPercent}%`;
  ui.hpTrack.setAttribute("aria-valuenow", String(Math.round(hpPercent)));

  if (hpPercent <= 25) {
    ui.bossHpBar.style.background = "linear-gradient(90deg, #d90429, #ff4d6d)";
  } else if (hpPercent <= 55) {
    ui.bossHpBar.style.background = "linear-gradient(90deg, #ff8c00, #ffb020)";
  } else {
    ui.bossHpBar.style.background = "linear-gradient(90deg, #ef476f, #ff7b6b)";
  }

  const damageDelta = totalDamage - previousTotalDamage;
  if (damageDelta > 0 && previousTotalDamage > 0 && state.role === "teacher") {
    animateBossHit(damageDelta, damageDelta >= 50);
    audioEngine.playSfx("hit");
  }
  previousTotalDamage = totalDamage;

  const defeated = currentHp <= 0;
  ui.bossImage.classList.toggle("defeated", defeated);

  if (defeated) {
    finishRoomIfNeeded();
    showVictoryModal();
  }
}

function renderLeaderboard() {
  const players = state.sortedPlayers;
  const onlinePlayers = players.filter((player) => player.presence?.online);
  ui.onlineCount.textContent = `${onlinePlayers.length} online`;
  ui.playerCountTeacher.textContent = `${players.length} học sinh`;

  if (players.length === 0) {
    ui.leaderboardList.innerHTML = `
      <div class="empty-state">
        <span>👥</span>
        <p>Chưa có học sinh trong phòng.</p>
      </div>`;
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const avatars = ["🧑‍🚀", "🧙", "🦸", "🥷", "🧑‍🎤", "🧑‍🔬", "🧑‍🎨", "🧝"];

  ui.leaderboardList.innerHTML = players.map((player, index) => {
    const isMe = player.uid === currentUser?.uid;
    const rankClass = index === 0 ? "top-1" : "";
    const rank = index < 3
      ? `<span class="rank-number medal">${medals[index]}</span>`
      : `<span class="rank-number">${index + 1}</span>`;
    const avatarIndex = Number(player.profile?.avatar || 0) % avatars.length;
    const online = Boolean(player.presence?.online);
    const correct = Number(player.stats?.correct || 0);
    const wrong = Number(player.stats?.wrong || 0);

    return `
      <div class="leaderboard-row ${rankClass} ${isMe ? "me" : ""}">
        ${rank}
        <img src="assets/avatars/${avatarIndex + 1}.png" class="player-avatar-img" alt="Avatar" />
        <div class="player-info">
          <strong>${escapeHtml(player.profile.name)}${isMe ? " (Bạn)" : ""}</strong>
          <small><span class="presence-dot ${online ? "online" : ""}"></span>${online ? "Online" : "Offline"} · ✅ ${correct} · ❌ ${wrong}</small>
        </div>
        <div class="player-damage">${formatNumber(getPlayerDamage(player))}<small>DMG</small></div>
      </div>`;
  }).join("");
}

function renderStudentStats() {
  if (state.role !== "student" || !currentUser) return;

  const me = getMyPlayer();
  const rankIndex = state.sortedPlayers.findIndex((player) => player.uid === currentUser.uid);
  ui.myDamageDisplay.textContent = formatNumber(getPlayerDamage(me));
  ui.myComboDisplay.textContent = `x${getPlayerCombo(me)}`;
  ui.myRankDisplay.textContent = rankIndex >= 0 ? `#${rankIndex + 1}` : "—";
}

function renderStudentPanel() {
  if (state.role !== "student" || !state.meta) return;

  const status = state.meta.status;
  const defeated = getBossHp() <= 0;

  if (status === "playing" && !defeated) {
    ui.waitingPanel.classList.add("hidden");
    ui.quizPanel.classList.remove("hidden");
    if (!currentQuestion || answerLocked) {
      window.setTimeout(() => {
        if (state.meta?.status === "playing" && getBossHp() > 0 && !currentQuestion) nextQuestion();
      }, 80);
    }
    if (!currentQuestion) nextQuestion();
    return;
  }

  ui.quizPanel.classList.add("hidden");
  ui.waitingPanel.classList.remove("hidden");
  currentQuestion = null;
  answerLocked = false;

  if (defeated || status === "finished") {
    ui.waitingTitle.textContent = "Boss đã bị đánh bại!";
    ui.waitingMessage.textContent = "Hãy xem kết quả chung cuộc trên bảng xếp hạng.";
  } else if (status === "paused") {
    ui.waitingTitle.textContent = "Trận đấu đang tạm dừng";
    ui.waitingMessage.textContent = "Đợi giáo viên tiếp tục trận đấu.";
  } else {
    ui.waitingTitle.textContent = "Đang chờ giáo viên bắt đầu";
    ui.waitingMessage.textContent = "Hãy sẵn sàng! Câu hỏi sẽ xuất hiện khi trận đấu bắt đầu.";
  }
}

function showVictoryModal() {
  triggerConfetti();
  if (victoryShown || state.sortedPlayers.length === 0) return;
  victoryShown = true;
  audioEngine.playSfx("victory");

  const topThree = state.sortedPlayers.slice(0, 3);
  const podiumClasses = ["first", "second", "third"];
  const medals = ["🥇", "🥈", "🥉"];

  ui.victorySubtitle.textContent = `Tổng sát thương: ${formatNumber(getTotalDamage())} DMG`;
  ui.podium.innerHTML = topThree.map((player, index) => `
    <div class="podium-item ${podiumClasses[index]}">
      <span>${medals[index]}</span>
      <strong>${escapeHtml(player.profile.name)}</strong>
      <small>${formatNumber(getPlayerDamage(player))} DMG</small>
    </div>`).join("");
  ui.victoryModal.classList.remove("hidden");
}

function closeVictoryModal() {
  ui.victoryModal.classList.add("hidden");
}

/* ------------------------------ SHARE / COPY ----------------------------- */
async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage, "success");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    showToast(successMessage, "success");
  }
}

function copyRoomCode() {
  if (!state.roomCode) return;
  copyText(state.roomCode, "Đã sao chép mã phòng.");
}

function copyInviteLink() {
  if (!state.roomCode) return;
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("room", state.roomCode);
  copyText(url.toString(), "Đã sao chép link mời.");
}

/* ------------------------------- EVENTS --------------------------------- */
function bindEvents() {
  $("#homeBtn").addEventListener("click", () => {
    if (state.roomCode) {
      showToast("Hãy bấm “Rời phòng” trước khi về trang chủ.", "warning");
      return;
    }
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
  ui.audioBtn.addEventListener("click", () => audioEngine.toggle());
  $("#closeVictoryBtn").addEventListener("click", closeVictoryModal);

  ui.roomCodeInput.addEventListener("input", () => {
    ui.roomCodeInput.value = normalizeRoomCode(ui.roomCodeInput.value);
  });

  window.addEventListener("beforeunload", () => {
    detachRoomListeners();
  });
}

function applyRoomCodeFromUrl() {
  const roomCode = normalizeRoomCode(new URLSearchParams(window.location.search).get("room"));
  if (roomCode.length === 6) {
    ui.roomCodeInput.value = roomCode;
    showScreen("studentJoin");
  }
}

/* -------------------------------- BOOT ---------------------------------- */
bindEvents();
applyRoomCodeFromUrl();
initializeFirebase();

/* ----------------------------- CONFETTI ----------------------------- */
function triggerConfetti() {
  const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];
  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-particle';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
    confetti.style.animationDelay = Math.random() * 2 + 's';
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 5000);
  }
}
