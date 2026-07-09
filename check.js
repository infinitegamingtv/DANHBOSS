const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');
code = code.replace(/import\s+[\s\S]*?from\s+["'].*?["'];/g, ''); // Remove multi-line imports
code = code.replace(/export /g, '');

// mock browser globals
global.window = { addEventListener: () => {}, location: { search: "" } };
global.document = {
  querySelector: () => ({ value: "", addEventListener: () => {}, classList: { toggle: () => {}, add: () => {}, remove: () => {} } }),
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { toggle: () => {}, add: () => {}, remove: () => {} } }),
  body: { appendChild: () => {} }
};
global.URLSearchParams = class { get() { return null; } };
global.localStorage = { getItem: () => null, setItem: () => {} };
global.Audio = class {};
global.Math = Math;
global.Date = Date;

try {
  eval(code);
  console.log("SUCCESS");
} catch(e) {
  console.error("RUNTIME ERROR:", e);
}
