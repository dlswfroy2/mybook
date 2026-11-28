import fs from 'fs';

const path = 'src/app/question-bank/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Find and fix the broken 'let cleaned' line in formatContentWithBoardMarks
// We need to find the line and replace it with correct version
const lines = content.split('\n');
let fixedLines = [];
let found = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('let cleaned = stripHtml(content).replace') && !found) {
    // Replace with correct simple version
    fixedLines.push("  let cleaned = stripHtml(content).replace(/^[\\u09E6-\\u09EF0-9]+[\\u09F7.)]/g, '').trim();");
    found = true;
    console.log('✅ Fixed let cleaned at line', i+1);
  } else {
    fixedLines.push(line);
  }
}

if (!found) {
  console.log('⚠️  Let cleaned not found!');
} else {
  content = fixedLines.join('\n');
  fs.writeFileSync(path, content, 'utf-8');
  console.log('✅ Saved');
  
  // Verify
  const v = fs.readFileSync(path, 'utf-8');
  const idx = v.indexOf('let cleaned = stripHtml');
  if (idx >= 0) {
    console.log('Verify:', v.slice(idx, idx+100));
  }
}
