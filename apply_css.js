const fs = require('fs');
let css = fs.readFileSync('style.css', 'utf8');

const newCSS = `

/* --- BOSS ANIMATIONS & PHASES --- */
#bossImage {
  transition: filter 0.5s ease;
}

#bossImage.boss-phase-2 {
  filter: drop-shadow(0 20px 18px rgba(78, 53, 39, 0.2)) hue-rotate(-15deg) saturate(1.2);
  animation: bossFloat 2s ease-in-out infinite, bossPanting 1s infinite alternate;
}

#bossImage.boss-phase-3 {
  filter: drop-shadow(0 20px 18px rgba(150, 20, 20, 0.4)) hue-rotate(-30deg) saturate(1.5);
  animation: bossFloat 1.5s ease-in-out infinite, bossShake 0.4s infinite;
}

#bossImage.enraged {
  filter: drop-shadow(0 20px 40px rgba(255, 0, 0, 0.8)) hue-rotate(-45deg) saturate(2) brightness(1.2) contrast(1.2);
  animation: bossEnragedShake 0.3s infinite;
  transform: scale(1.15);
}

#bossImage.defeated {
  animation: bossDissolve 1.5s ease forwards;
}

@keyframes bossPanting {
  0% { transform: scale(1) translateY(0); }
  100% { transform: scale(1.02) translateY(5px); }
}

@keyframes bossShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px) rotate(-2deg); }
  75% { transform: translateX(3px) rotate(2deg); }
}

@keyframes bossEnragedShake {
  0%, 100% { transform: scale(1.15) translate(0, 0); }
  25% { transform: scale(1.15) translate(-4px, 4px) rotate(-3deg); }
  50% { transform: scale(1.15) translate(4px, -4px) rotate(3deg); }
  75% { transform: scale(1.15) translate(-4px, -4px) rotate(-3deg); }
}

@keyframes bossDissolve {
  0% { transform: translateY(0) scale(1); filter: grayscale(0) blur(0) brightness(1); opacity: 1; }
  50% { transform: translateY(20px) scale(0.9); filter: grayscale(0.5) blur(2px) brightness(1.5); opacity: 0.8; }
  100% { transform: translateY(50px) scale(0.5); filter: grayscale(1) blur(10px) brightness(0.2); opacity: 0; }
}

/* --- GAME TIMER --- */
.game-timer {
  background: rgba(15, 23, 42, 0.8);
  color: #fff;
  padding: 6px 16px;
  border-radius: 20px;
  font-family: 'Baloo 2', cursive;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
  box-shadow: 0 0 10px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255,255,255,0.1);
}

.game-timer.danger {
  color: #ff4757;
  animation: timerPulse 1s infinite;
}

@keyframes timerPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

/* --- RESPONSIVE 4:3 & NO SCROLL --- */
@media (max-width: 980px) and (max-height: 1200px) {
  body, html {
    overflow: hidden; /* Ngăn cuộn dọc */
    height: 100%;
  }

  .app-shell {
    height: calc(100vh - 120px);
    display: flex;
    flex-direction: column;
  }
  
  .room-layout {
    grid-template-columns: 1fr;
    height: 100%;
    margin-top: 10px;
    gap: 10px;
    display: flex;
    flex-direction: column;
  }
  
  .battle-column {
    flex: 0 0 auto;
    gap: 10px;
  }

  .battle-card {
    padding: 12px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .boss-stage {
    min-height: 150px; /* Thu nhỏ mạnh stage */
    height: 25vh;
    margin: 10px 0;
  }
  
  #bossImage {
    max-height: 100%;
    width: auto;
  }
  
  .hp-panel {
    margin-bottom: 0;
  }
  
  /* Student Panel chiếm không gian còn lại */
  .student-game-panel {
    flex: 1 1 0; 
    overflow-y: auto; /* Cho phép cuộn bên trong nếu câu hỏi dài */
    padding: 12px;
    display: flex;
    flex-direction: column;
  }

  .quiz-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  #questionText {
    font-size: 18px; /* Chữ nhỏ lại một chút */
    margin: 10px 0;
  }

  .answer-grid {
    gap: 8px;
    margin-bottom: 10px;
  }

  .answer-button {
    padding: 10px 14px;
    min-height: 44px;
    font-size: 14px;
  }
  
  .answer-feedback {
    margin-top: auto; /* Đẩy xuống dưới cùng */
    padding: 10px;
  }
}
`;

fs.writeFileSync('style.css', css + newCSS);
console.log('Appended CSS to style.css');
