const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

const oldSet = `    const pRef = db.ref('rooms/' + roomCode + '/players/' + currentUser.uid);
    pRef.set({
      profile: { name: studentName, avatar: randomAvatarId, joinedAt: Date.now() },
      stats: { damage: 0, combo: 0, correct: 0, wrong: 0, bestCombo: 0, lastAttackAt: 0 }
    }).then(() => {`;

const newSet = `    const pRef = db.ref('rooms/' + roomCode + '/players/' + currentUser.uid);
    pRef.child('profile').set({ name: studentName, avatar: randomAvatarId, joinedAt: Date.now() }).then(() => {
      return pRef.child('stats').set({ damage: 0, combo: 0, correct: 0, wrong: 0, bestCombo: 0, lastAttackAt: 0 });
    }).then(() => {`;

code = code.replace(oldSet, newSet);

fs.writeFileSync('script.js', code);
console.log('Fixed joinRoom sequence');
