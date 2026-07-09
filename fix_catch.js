const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

const oldSet = `    setButtonLoading($("#createRoomForm button"), false);
  });
}`;

const newSet = `    setButtonLoading($("#createRoomForm button"), false);
  }).catch(e => {
    console.error(e);
    showToast("Không thể tạo phòng: " + e.message, "error");
    setButtonLoading($("#createRoomForm button"), false);
  });
}`;

code = code.replace(oldSet, newSet);

const oldJoin = `      setButtonLoading($("#joinRoomForm button"), false);
      showScreen("room");
      audioEngine.setMode("lobby");
    });
  });
}`;

const newJoin = `      setButtonLoading($("#joinRoomForm button"), false);
      showScreen("room");
      audioEngine.setMode("lobby");
    }).catch(e => {
      console.error(e);
      showToast("Lỗi tham gia: " + e.message, "error");
      setButtonLoading($("#joinRoomForm button"), false);
    });
  }).catch(e => {
    console.error(e);
    showToast("Không thể kết nối phòng: " + e.message, "error");
    setButtonLoading($("#joinRoomForm button"), false);
  });
}`;

code = code.replace(oldJoin, newJoin);

fs.writeFileSync('script.js', code);
console.log('Added catch blocks');
