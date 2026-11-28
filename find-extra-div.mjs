import fs from 'fs';

const path = 'src/app/create-question/page.tsx';
const content = fs.readFileSync(path, 'utf-8');
const lines = content.split('\n');

// Find exactly where depth becomes unbalanced
let depth = 0;
let firstUnbalance = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/<div[\s>]/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  const prev = depth;
  depth += opens - closes;
  
  if (depth < prev && depth < 0 && firstUnbalance < 0) {
    firstUnbalance = i + 1;
    // Show context around this line
    console.log('\n=== FIRST IMBALANCE at line', i + 1, '===');
    for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 3); j++) {
      console.log(j + 1, ':', lines[j]);
    }
  }
  
  // Show each close line tracking depth
  if (closes > 0 && i > 2100) {
    console.log(`Line ${i+1} (depth ${prev}→${depth}): ${line.trim().slice(0,70)}`);
  }
}

console.log('\nFinal depth:', depth);

// Also: simple approach - find all </div> near the end (last 100 lines) where depth would go negative
console.log('\n=== Last 50 lines ===');
for (let i = Math.max(0, lines.length - 50); i < lines.length; i++) {
  if (lines[i].trim()) console.log(i + 1, ':', lines[i].trim().slice(0, 80));
}
