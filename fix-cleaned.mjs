import fs from 'fs';

const path = 'src/app/question-bank/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Fix the malformed 'let cleaned' line
// It currently has: let cleaned = stripHtml(content).replace(/^[০-৯0-9]+[।.]    .replace(/^[০-৯0-9]+[।.)]s*/, '')
// Should be: let cleaned = stripHtml(content).replace(/^[০-৯0-9]+[।.)]\s*/, '').trim();
const badLine = `let cleaned = stripHtml(content).replace(/^[০-৯0-9]+[।.]    .replace(/^[০-৯0-9]+[।.)]s*/, '')
    .trim();`;
const goodLine = `let cleaned = stripHtml(content).replace(/^[০-৯0-9]+[।.)]\s*/, '').trim();`;

if (content.includes(badLine)) {
  content = content.replace(badLine, goodLine);
  console.log('✅ Fixed let cleaned line');
} else {
  // Try to find and replace differently
  const idx = content.indexOf('let cleaned = stripHtml(content).replace');
  const endIdx = content.indexOf('.trim();', idx) + '.trim();'.length;
  if (idx >= 0 && endIdx > idx) {
    const before = content.slice(0, idx);
    const after = content.slice(endIdx);
    content = before + "let cleaned = stripHtml(content).replace(/^[০-৯0-9]+[।.)]/g, '').trim();" + after;
    console.log('✅ Fixed let cleaned line (alt)');
  } else {
    console.log('⚠️  Could not find bad cleaned line');
  }
}

fs.writeFileSync(path, content, 'utf-8');
console.log('Done. Verifying...');

// Verify no bad patterns remain
const v = fs.readFileSync(path, 'utf-8');
const checkIdx = v.indexOf('let cleaned = stripHtml');
console.log('Verify:', v.slice(checkIdx, checkIdx+100));
