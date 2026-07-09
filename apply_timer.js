const fs = require('fs');

let code = fs.readFileSync('script.js', 'utf8');

// Add to UI obj
code = code.replace(
  'gameStatusPill: $("#gameStatusPill"),', 
  'gameStatusPill: $("#gameStatusPill"),\n  gameTimerDisplay: $("#gameTimerDisplay"),'
);

// Add global timer var
code = code.replace(
  'let finishingRoom = false;',
  'let finishingRoom = false;\nlet gameTimerInterval = null;'
);

// Update statusMap and syncUI
code = code.replace(
  /const statusMap = \{[\s\S]*?\};/,
  `const statusMap = {
    waiting: { text: "Sảnh Chờ", color: "var(--warning)", bg: "rgba(253, 203, 110, 0.2)" },
    playing: { text: "Đang Chiến Đấu", color: "var(--success)", bg: "rgba(0, 184, 148, 0.2)" },
    paused: { text: "Tạm Dừng", color: "var(--warning)", bg: "rgba(253, 203, 110, 0.2)" },
    finished: { text: "Chiến Thắng", color: "var(--success)", bg: "rgba(0, 184, 148, 0.2)" },
    failed: { text: "Thất Bại", color: "var(--danger)", bg: "rgba(214, 48, 49, 0.2)" }
  };`
);

code = code.replace(
  /if \(meta\.status === "waiting"\) \{[\s\S]*?if \(meta\.status === "playing" && !currentQuestion\) \{/m,
  `if (meta.status === "waiting") {
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

    if (meta.status === "playing" && !currentQuestion) {`
);

// Call updateTimerDisplay in syncUI
code = code.replace(
  'renderLeaderboard();',
  'renderLeaderboard();\n  updateTimerDisplay();\n  updateBossVisuals();'
);

// Insert timer and boss functions
const newFns = `
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
    if(ui.gameTimerDisplay) ui.gameTimerDisplay.textContent = \`\${mins}:\${secs}\`;
    
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
`;

code = code.replace(
  'function renderRoomInfo() {',
  newFns + '\nfunction renderRoomInfo() {'
);

// Start game logic
code = code.replace(
  'await updateRoomMeta({ status: "playing" });',
  'await updateRoomMeta({ status: "playing", startTime: Date.now(), durationMs: 10 * 60 * 1000 });' // 10 minutes
);

// End game / Reset game audio
code = code.replace(
  'if (state.meta.status === "waiting" || state.meta.status === "finished") audioEngine.setMode("lobby");',
  'if (state.meta.status === "waiting" || state.meta.status === "finished" || state.meta.status === "failed") audioEngine.setMode("lobby");'
);

// Hide buttons for failed state
code = code.replace(
  'ui.resetGameBtn.classList.toggle("hidden", meta.status !== "finished" && meta.status !== "playing" && meta.status !== "paused");',
  'ui.resetGameBtn.classList.toggle("hidden", meta.status !== "finished" && meta.status !== "failed" && meta.status !== "playing" && meta.status !== "paused");'
);
code = code.replace(
  'ui.endGameBtn.classList.toggle("hidden", meta.status === "finished" || meta.status === "waiting");',
  'ui.endGameBtn.classList.toggle("hidden", meta.status === "finished" || meta.status === "failed" || meta.status === "waiting");'
);

// Prevent answer locked bug when status is failed
code = code.replace(
  'if (state.meta?.status !== "playing" || getBossHp() <= 0) return;',
  'if (state.meta?.status !== "playing" || getBossHp() <= 0) return;'
); // this was already there

fs.writeFileSync('script.js', code);
console.log('Script updated for Timer & Enrage');
