const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

// Replace "waiting" with "lobby"
code = code.replace(/statusMap\.waiting/g, 'statusMap.lobby');
code = code.replace(/waiting:/g, 'lobby:');
code = code.replace(/"waiting"/g, '"lobby"');

// Fix createRoom meta
const oldMeta = `  const meta = {
    hostUid: currentUser.uid,
    teacherName, className, bossType, maxBossHp: bossHp,
    status: "lobby", roomLocked: false, createdAt: Date.now()
  };`;

const newMeta = `  const meta = {
    hostUid: currentUser.uid,
    teacherName, className, bossType, maxBossHp: bossHp,
    status: "lobby", roomLocked: false, createdAt: Date.now(),
    bossName: BOSS_CONFIG[bossType]?.name || "Boss", startedAt: 0, endedAt: 0, hostOnline: true
  };`;
code = code.replace(oldMeta, newMeta);

fs.writeFileSync('script.js', code);
console.log('Fixed waiting to lobby and added missing meta fields.');
