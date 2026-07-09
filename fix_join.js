const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

// Fix avatar in joinRoom
const oldAvatarLogic = `    const avatars = ["avatar_1.png", "avatar_2.png", "avatar_3.png", "avatar_4.png", "avatar_5.png", "avatar_6.png", "avatar_7.png", "avatar_8.png"];
    const randomAvatar = "assets/avatars/" + avatars[Math.floor(Math.random() * avatars.length)];
    
    const pRef = db.ref('rooms/' + roomCode + '/players/' + currentUser.uid);
    pRef.set({
      profile: { name: studentName, avatar: randomAvatar, joinedAt: Date.now() },
      stats: { damage: 0, combo: 0, correct: 0, wrong: 0 }
    })`;

const newAvatarLogic = `    const randomAvatarId = Math.floor(Math.random() * 8); // 0 to 7
    
    const pRef = db.ref('rooms/' + roomCode + '/players/' + currentUser.uid);
    pRef.set({
      profile: { name: studentName, avatar: randomAvatarId, joinedAt: Date.now() },
      stats: { damage: 0, combo: 0, correct: 0, wrong: 0, bestCombo: 0, lastAttackAt: 0 }
    })`;
    
code = code.replace(oldAvatarLogic, newAvatarLogic);

// Wait, the UI renders the avatar string like: 
// p.profile?.avatar || 'assets/avatars/avatar_1.png'
// If avatar is a number 0-7, how was it rendered in the original code?
// Probably \`assets/avatars/avatar_\${p.profile.avatar + 1}.png\`
// Let's also fix renderLeaderboard to handle number avatar
const oldAvatarRender = `src="\${p.profile?.avatar || 'assets/avatars/avatar_1.png'}"`;
const newAvatarRender = `src="\${typeof p.profile?.avatar === 'number' ? 'assets/avatars/avatar_' + (p.profile.avatar + 1) + '.png' : (p.profile?.avatar || 'assets/avatars/avatar_1.png')}"`;
code = code.replace(oldAvatarRender, newAvatarRender);


// Fix submitAnswer transaction
const oldTransaction = `      if (stats) {
        stats.damage += damage;
        stats.combo = newCombo;
        if (isCorrect) stats.correct++;
        else stats.wrong++;
      }
      return stats;`;

const newTransaction = `      if (stats) {
        stats.damage += damage;
        stats.combo = newCombo;
        if (isCorrect) stats.correct++;
        else stats.wrong++;
        if (stats.combo > (stats.bestCombo || 0)) stats.bestCombo = stats.combo;
        stats.lastAttackAt = Date.now();
      }
      return stats;`;
code = code.replace(oldTransaction, newTransaction);

fs.writeFileSync('script.js', code);
console.log('Fixed join validation');
