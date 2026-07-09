const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyB7GEG6gSDRBxKFmuo0iG_wt-IsTaDyHWU",
  authDomain: "test-aa50d.firebaseapp.com",
  databaseURL: "https://test-aa50d-default-rtdb.firebaseio.com",
  projectId: "test-aa50d",
  storageBucket: "test-aa50d.firebasestorage.app",
  messagingSenderId: "160629020295",
  appId: "1:160629020295:web:f651d69adcffb025f68a22"
};

const firebaseLogic = `
/* --------------------------------- FIREBASE NETWORK ---------------------------------- */
const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};
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
    showToast(\`Phòng \${state.roomCode} đã tạo thành công!\`, "success");
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
    ? (critical ? \`<strong>CRITICAL!</strong> Chính xác — gây \${damage} sát thương!<br/><small>\${escapeHtml(currentQuestion.explanation || '')}</small>\` : \`Chính xác — gây \${damage} sát thương!<br/><small>\${escapeHtml(currentQuestion.explanation || '')}</small>\`)
    : \`Chưa đúng. Đáp án là: <strong>\${escapeHtml(currentQuestion.answers[currentQuestion.correctIndex])}</strong><br/><small>\${escapeHtml(currentQuestion.explanation || '')}</small>\`;
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
`;

const code = fs.readFileSync('script.js', 'utf8');
const p2pStart = code.indexOf('/* --------------------------------- WEBRTC P2P ---------------------------------- */');
const shareStart = code.indexOf('/* ------------------------------- SHARE --------------------------------- */');

const finalCode = code.substring(0, p2pStart) + firebaseLogic + code.substring(shareStart);

let cleaned = finalCode.replace('let peer = null;\\nlet hostConn = null;\\nlet hostConnections = {};\\n', '');
fs.writeFileSync('script.js', cleaned);
console.log('Firebase integrated successfully.');
