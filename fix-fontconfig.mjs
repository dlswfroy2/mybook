import fs from 'fs';

const path = 'src/app/question-bank/page.tsx';
let c = fs.readFileSync(path, 'utf-8');

// Fix 1: FONT_SIZE_CONFIG.base does not exist — replace with FONT_SIZE_CONFIG['13']
const before = (c.match(/FONT_SIZE_CONFIG\.base/g) || []).length;
c = c.split('FONT_SIZE_CONFIG.base').join("FONT_SIZE_CONFIG['13']");
const after = (c.match(/FONT_SIZE_CONFIG\.base/g) || []).length;
console.log(`Fixed FONT_SIZE_CONFIG.base: ${before} → ${after} remaining`);

// Fix 2: Check for other missing keys
const checks = [
  ['FONT_SIZE_CONFIG.normal', "FONT_SIZE_CONFIG['13']"],
  ['FONT_FAMILY_CONFIG.base', "FONT_FAMILY_CONFIG.kalpurush"],
];
for (const [bad, good] of checks) {
  const cnt = (c.split(bad).length - 1);
  if (cnt > 0) {
    c = c.split(bad).join(good);
    console.log(`Fixed ${bad}: ${cnt} occurrences`);
  }
}

fs.writeFileSync(path, c, 'utf-8');
console.log('Done. Verifying...');

// Also show the line with FONT_SIZE_CONFIG to confirm
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('FONT_SIZE_CONFIG') && l.includes('||')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
