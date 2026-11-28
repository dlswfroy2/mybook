import fs from 'fs';

const path = 'src/app/create-question/page.tsx';
const content = fs.readFileSync(path, 'utf-8');
const lines = content.split('\n');

// Track JSX div depth to find mismatches
let depth = 0;
let maxDepth = 0;
const issues = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Count opening divs (simple heuristic)
  const opens = (line.match(/<div[\s>]/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  
  depth += opens - closes;
  
  if (depth < 0) {
    issues.push({ line: i + 1, depth, text: line.trim().slice(0, 80) });
    console.log(`⚠️  NEGATIVE DEPTH at line ${i+1} (depth=${depth}): ${line.trim().slice(0,80)}`);
  }
  
  if (Math.abs(opens - closes) > 2) {
    console.log(`Line ${i+1}: opens=${opens} closes=${closes}: ${line.trim().slice(0,60)}`);
  }
}

console.log(`\nFinal depth: ${depth} (should be 0 for balanced)`);
if (depth !== 0) {
  console.log('⚠️  UNBALANCED! Extra close divs:', Math.max(0, -depth), 'Extra open divs:', Math.max(0, depth));
}

// Also check for specific patterns from the fix
const fixedArea = content.indexOf('এই লাইভ লেআউট থেকে সরাসরি');
if (fixedArea >= 0) {
  console.log('\n⚠️  Button was NOT removed! Still present at char:', fixedArea);
} else {
  console.log('\n✅ Second button not found (correctly removed)');
}

// Find exact spot where the extra div might be
// Look for the flex div wrapper that contained the removed button
const flexIdx = content.indexOf('flex items-center gap-2');
let idx = 0;
let count = 0;
while (true) {
  idx = content.indexOf('flex items-center gap-2', idx);
  if (idx < 0) break;
  count++;
  const lineNum = content.slice(0, idx).split('\n').length;
  console.log(`"flex items-center gap-2" #${count} at line ${lineNum}: ...${content.slice(idx-20, idx+60)}...`);
  idx++;
}
