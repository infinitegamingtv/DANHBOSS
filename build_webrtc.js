const fs = require('fs');
const oldCode = fs.readFileSync('script.js', 'utf8');

// Extraction helpers
function getBlock(startStr, endStr) {
  const start = oldCode.indexOf(startStr);
  let end = -1;
  if (endStr) {
    end = oldCode.indexOf(endStr, start);
    if (end !== -1) end += endStr.length;
  }
  if (start === -1) throw new Error(`Could not find ${startStr}`);
  return oldCode.slice(start, end !== -1 ? end : undefined);
}

// Extract AudioEngine
const audioEngineCode = getBlock('class AudioEngine {', 'const audioEngine = new AudioEngine();');

// Extract DOM / Config
const configCode = getBlock('const USE_GENERATED_AUDIO', 'const NEXT_QUESTION_DELAY_MS = 950;');

const domCodeStart = getBlock('const $ = (selector)', 'ui.toastContainer.appendChild(toast);\n}');

const uiLogicCode = getBlock('/* -------------------------------- RENDER -------------------------------- */', '/* ------------------------------ SHARE / COPY ----------------------------- */');

// Remove Firebase specific things from UI logic
let cleanedUiLogic = uiLogicCode.replace(/friendlyFirebaseError.*?\}\n/gs, '');

const shareCode = getBlock('/* ------------------------------ SHARE / COPY ----------------------------- */', '/* ------------------------------- EVENTS --------------------------------- */');

const confettiCode = getBlock('/* ----------------------------- CONFETTI ----------------------------- */', '}');

const newScript = `
/* --------------------------------------------------------------------------
   WEB-RTC (PEERJS) NETWORK LOGIC
   Thay thế Firebase bằng Peer-to-Peer.
---------------------------------------------------------------------------- */

${configCode}

let peer = null;
let hostConnections = {}; // For Teacher
let hostConn = null; // For Student
let currentUser = { uid: "user_" + Math.random().toString(36).substr(2, 9) };

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

${domCodeStart}

/* -------------------------------- BOOT ---------------------------------- */
function initializeNetwork() {
  setConnectionStatus(true, "Mạng P2P sẵn sàng");
}

function setConnectionStatus(connected, text = "") {
  ui.connectionBadge.classList.toggle("online", connected);
  ui.connectionBadge.classList.toggle("offline", !connected);
  ui.connectionBadge.textContent = text || (connected ? "Đã kết nối" : "Chưa kết nối");
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

function getMyPlayer() {
  return state.players[currentUser.uid];
}

function isHost() {
  return Boolean(state.meta?.hostUid === currentUser.uid);
}

function broadcastState() {
  if (!isHost()) return;
  const stateData = { meta: state.meta, players: state.players };
  Object.values(hostConnections).forEach(conn => {
    if (conn.open) conn.send({ type: "state", data: stateData });
  });
  syncUI();
}

async function updateRoomMeta(updates) {
  if (!isHost()) return false;
  state.meta = { ...state.meta, ...updates };
  broadcastState();
  return true;
}

/* ------------------------------ ROOM CREATE ------------------------------ */
function generateRoomCode() {
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += ROOM_CODE_CHARACTERS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARACTERS.length));
  }
  return result;
}

function createRoom(e) {
  e.preventDefault();
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
  
  if (peer) peer.destroy();
  peer = new Peer("class-boss-" + state.roomCode);
  
  peer.on('open', (id) => {
    state.role = "teacher";
    state.displayName = teacherName;
    currentUser.uid = "host_" + state.roomCode;
    
    state.meta = {
      hostUid: currentUser.uid,
      teacherName,
      className,
      bossType,
      maxBossHp: bossHp,
      status: "waiting",
      roomLocked: false,
      createdAt: Date.now()
    };
    state.players = {};
    
    setupHostPeer();
    syncUI();
    showScreen("room");
    showToast(\`Phòng \${state.roomCode} đã tạo thành công!\`, "success");
    setButtonLoading($("#createRoomForm button"), false);
  });
  
  peer.on('error', (err) => {
    showToast("Lỗi tạo phòng: " + err.message, "error");
    setButtonLoading($("#createRoomForm button"), false);
  });
}

function setupHostPeer() {
  peer.on('connection', (conn) => {
    conn.on('data', (data) => {
      if (data.type === "join") {
        if (state.meta.roomLocked || state.meta.status === "finished") {
          conn.send({ type: "error", message: "Phòng đang khóa hoặc đã kết thúc." });
          setTimeout(() => conn.close(), 1000);
          return;
        }
        
        hostConnections[data.uid] = conn;
        state.players[data.uid] = {
          profile: { name: data.name, avatar: data.avatar, joinedAt: Date.now() },
          stats: { damage: 0, combo: 0, correct: 0, wrong: 0 }
        };
        broadcastState();
        conn.send({ type: "welcome", uid: data.uid });
        showToast(\`Học sinh \${data.name} đã tham gia.\`, "info");
      }
      
      if (data.type === "attack") {
        const player = state.players[data.uid];
        if (!player || state.meta.status !== "playing") return;
        
        player.stats.damage += data.damage;
        player.stats.correct += data.isCorrect ? 1 : 0;
        player.stats.wrong += data.isCorrect ? 0 : 1;
        player.stats.combo = data.combo;
        broadcastState();
      }
    });
    
    conn.on('close', () => {
      let disUid = Object.keys(hostConnections).find(k => hostConnections[k] === conn);
      if (disUid) {
         delete hostConnections[disUid];
         // Giữ lại stats trên Leaderboard
      }
    });
  });
}

/* ------------------------------ ROOM JOIN ------------------------------ */
function normalizeRoomCode(code) {
  return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function joinRoom(e) {
  e.preventDefault();
  const roomCode = normalizeRoomCode(ui.roomCodeInput.value);
  const studentName = ui.studentNameInput.value.trim();

  if (roomCode.length !== 6 || !studentName) {
    showToast("Vui lòng điền đủ thông tin.", "warning");
    return;
  }

  setButtonLoading($("#joinRoomForm button"), true);
  
  if (peer) peer.destroy();
  peer = new Peer(); 
  
  peer.on('open', (id) => {
    hostConn = peer.connect("class-boss-" + roomCode);
    
    hostConn.on('open', () => {
      currentUser.uid = "player_" + id;
      state.role = "student";
      state.roomCode = roomCode;
      state.displayName = studentName;
      
      const avatars = ["avatar_1.png", "avatar_2.png", "avatar_3.png", "avatar_4.png", "avatar_5.png", "avatar_6.png", "avatar_7.png", "avatar_8.png"];
      const randomAvatar = "assets/avatars/" + avatars[Math.floor(Math.random() * avatars.length)];
      
      hostConn.send({ type: "join", uid: currentUser.uid, name: studentName, avatar: randomAvatar });
      
      setButtonLoading($("#joinRoomForm button"), false);
      showScreen("room");
    });
    
    hostConn.on('data', (msg) => {
      if (msg.type === "state") {
        state.meta = msg.data.meta;
        state.players = msg.data.players;
        syncUI();
      }
      if (msg.type === "error") {
        showToast(msg.message, "error");
        leaveRoom();
      }
    });
    
    hostConn.on('close', () => {
      showToast("Mất kết nối với giáo viên.", "error");
      leaveRoom();
    });
  });
  
  peer.on('error', (err) => {
    showToast("Không tìm thấy phòng hoặc lỗi mạng.", "error");
    setButtonLoading($("#joinRoomForm button"), false);
  });
}

function leaveRoom(manual = false) {
  if (isHost()) {
    Object.values(hostConnections).forEach(c => c.close());
    hostConnections = {};
  } else {
    if (hostConn) hostConn.close();
  }
  if (peer) {
     peer.destroy();
     peer = null;
  }
  
  hostConn = null;
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
  await updateRoomMeta({ status: "playing" });
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
  state.players = {}; // Reset all players stats
  Object.values(hostConnections).forEach(conn => conn.close());
  hostConnections = {};
  
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
function nextQuestion() {
  if (state.meta?.status !== "playing" || getBossHp() <= 0) return;
  
  const QUESTION_BANK = window.QUESTION_BANK;
  let next = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
  if (QUESTION_BANK.length > 1) {
    while (next === currentQuestion) {
      next = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
    }
  }
  currentQuestion = next;
  questionNumber++;
  answerLocked = false;
  renderQuestion();
}

function renderQuestion() {
  if (!currentQuestion) return;
  ui.questionCategory.textContent = currentQuestion.category;
  ui.questionCounter.textContent = \`Câu \${questionNumber}\`;
  ui.questionText.textContent = currentQuestion.question;
  ui.answerFeedback.textContent = "";
  ui.answerFeedback.className = "answer-feedback";
  ui.answerGrid.innerHTML = "";

  currentQuestion.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.innerHTML = \`<strong>\${String.fromCharCode(65 + index)}.</strong> \${escapeHtml(answer)}\`;
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

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
  }[tag]));
}

async function submitAnswer(selectedIndex, selectedButton) {
  if (answerLocked || !currentQuestion || state.meta?.status !== "playing" || getBossHp() <= 0) return;

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
    ? (critical ? \`<strong>CRITICAL!</strong> Chính xác — gây \${damage} sát thương!<br/><small>\${escapeHtml(currentQuestion.explanation || '')}</small>\` : \`Chính xác — gây \${damage} sát thương!<br/><small>\${escapeHtml(currentQuestion.explanation || '')}</small>\`)
    : \`Chưa đúng. Đáp án là: <strong>\${escapeHtml(currentQuestion.answers[currentQuestion.correctIndex])}</strong><br/><small>\${escapeHtml(currentQuestion.explanation || '')}</small>\`;
  ui.answerFeedback.classList.add(isCorrect ? "good" : "bad");

  if (hostConn && hostConn.open) {
    hostConn.send({
      type: "attack",
      uid: currentUser.uid,
      damage: damage,
      isCorrect: isCorrect,
      combo: newCombo
    });
  }

  if (isCorrect) {
    audioEngine.playSfx("correct");
    if (critical) audioEngine.playSfx("hit");
  } else {
    audioEngine.playSfx("wrong");
  }

  setTimeout(() => {
    if (state.meta?.status === "playing" && getBossHp() > 0) {
      nextQuestion();
    }
  }, NEXT_QUESTION_DELAY_MS);
}

${cleanedUiLogic}

${audioEngineCode}

${shareCode}

${confettiCode}

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
}

/* -------------------------------- BOOT ---------------------------------- */
bindEvents();
initializeNetwork();
`;

fs.writeFileSync('script_webrtc.js', newScript);
console.log('Created script_webrtc.js!');
