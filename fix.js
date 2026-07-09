const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

const regex = /function setButtonLoading\([\s\S]*?ui\.toastContainer\.appendChild\(toast\);\n\}/;
code = code.replace(regex, `function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Đang xử lý...";
    btn.disabled = true;
  } else {
    if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
    btn.disabled = false;
  }
}`);

fs.writeFileSync('script.js', code);
console.log('Fixed syntax');
