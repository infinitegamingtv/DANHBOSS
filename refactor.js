const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

// 1. Remove Firebase imports
code = code.replace(/import \{[\s\S]*?\} from "https:\/\/www\.gstatic\.com\/firebasejs.*?;\n/g, '');

// 2. Remove Firebase Config
code = code.replace(/\/\* --------------------------------------------------------------------------\s+1\) FIREBASE CONFIG[\s\S]*?const firebaseConfig = \{[\s\S]*?\};\n/, '/* 1) FIREBASE CONFIG REMOVED (USING WEBRTC) */\n');

// 3. Replace globals
code = code.replace(/let app = null;\nlet auth = null;\nlet db = null;\nlet currentUser = null;\nlet unsubMeta = null;\nlet unsubPlayers = null;/, `let peer = null;
let hostConn = null;
let hostConnections = {};
let currentUser = { uid: "user_" + Math.random().toString(36).substr(2, 9) };`);

// 4. Replace isFirebaseConfigured
code = code.replace(/function isFirebaseConfigured\(\) \{[\s\S]*?\}/, 'function isFirebaseConfigured() { return true; }');

// 5. Replace requireFirebase
code = code.replace(/function requireFirebase\(\) \{[\s\S]*?\}/, `function requireFirebase() {
  if (!peer) {
    showToast("Lỗi mạng WebRTC.", "error");
    return false;
  }
  return true;
}`);

// 6. Replace initializeFirebase with initializeNetwork
code = code.replace(/async function initializeFirebase\(\) \{[\s\S]*?function friendlyFirebaseError.*?\}\n/g, `async function initializeFirebase() {
  setConnectionStatus(true, "Mạng P2P sẵn sàng");
  await tryRestoreSession();
}
`);

// 7. Replace tryRestoreSession
code = code.replace(/async function tryRestoreSession\(\) \{[\s\S]*?\}\n/, `async function tryRestoreSession() {
  const saved = getSavedSession();
  if (!saved?.roomCode || !saved?.role || state.roomCode) return;
  // Khôi phục session sẽ khó hơn trong WebRTC do session bị ngắt khi tải lại trang, 
  // ta chỉ xóa session nếu có.
  clearSession();
}
`);

// 8. Replace createRoom
code = code.replace(/async function createRoom\(e\) \{[\s\S]*?\}\n/, `async function createRoom(e) {
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
    
    saveSession();
    setupHostPeer();
    syncUI();
    showScreen("room");
    showToast(\`Phòng \${state.roomCode} đã tạo thành công!\`, "success");
    setButtonLoading($("#createRoomForm button"), false);
  });
  
  peer.on('error', (err) => {
    showToast("Lỗi mạng: " + err.message, "error");
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
          profile: {
            name: data.name,
            avatar: data.avatar,
            joinedAt: Date.now()
          },
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
      // Find disconnected player uid
      let disUid = Object.keys(hostConnections).find(k => hostConnections[k] === conn);
      if (disUid && state.players[disUid]) {
         // keep stats, do not delete to maintain leaderboard
      }
    });
  });
}

function broadcastState() {
  if (!isHost()) return;
  const stateData = { meta: state.meta, players: state.players };
  Object.values(hostConnections).forEach(conn => {
    if (conn.open) conn.send({ type: "state", data: stateData });
  });
  syncUI();
}
`);

// 9. Replace joinRoom
code = code.replace(/async function joinRoom\(e\) \{[\s\S]*?\}\n/, `async function joinRoom(e) {
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
      
      saveSession();
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
`);

// 10. Replace leaveRoom and listenToRoom
code = code.replace(/async function leaveRoom.*?\{[\s\S]*?\n\}/, `async function leaveRoom(manual = false) {
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
  
  clearSession();
  resetQuizState();
  audioEngine.stopBgm();
  
  if (manual) showToast("Đã rời phòng.");
  showScreen("home");
}`);

code = code.replace(/function listenToRoom\(\) \{[\s\S]*?\}\n/, `function listenToRoom() { }`);
code = code.replace(/function detachRoomListeners\(\) \{[\s\S]*?\}\n/, `function detachRoomListeners() { }`);

// 11. Replace updateRoomMeta
code = code.replace(/async function updateRoomMeta\(updates\) \{[\s\S]*?\}\n/, `async function updateRoomMeta(updates) {
  if (!isHost()) return false;
  state.meta = { ...state.meta, ...updates };
  broadcastState();
  return true;
}
`);

// 12. Replace submitAnswer transaction
code = code.replace(/try \{\n\s+const statsRef[\s\S]*?\} catch \(error\) \{[\s\S]*?\}\n/g, `
  if (isHost()) {
    // If teacher plays? Currently teacher doesn't play.
  } else if (hostConn && hostConn.open) {
    hostConn.send({
      type: "attack",
      uid: currentUser.uid,
      damage: damage,
      isCorrect: isCorrect,
      combo: newCombo
    });
  }
`);

fs.writeFileSync('script.js', code);
console.log("Refactoring complete");
