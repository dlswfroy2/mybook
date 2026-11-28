import fs from 'fs';

const path = 'src/app/question-bank/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Remove the bad HTML stripping code and rawLines merging that caused syntax errors
// Replace with correct TypeScript-safe version

const badStart = '  // Strip any HTML tags that might have been saved from DOM (old data cleanup)\n  let cleaned = content\n    .replace(/<br';
const badEnd = "    .replace(/^[০-৯0-9]+[।.)]";
const goodOriginal = "  let cleaned = content.replace(/^[০-৯0-9]+[।.)]";

const startIdx = content.indexOf(badStart);
const endIdx = content.indexOf(badEnd, startIdx);

if (startIdx >= 0 && endIdx > startIdx) {
  // Replace with clean, correct version
  const before = content.slice(0, startIdx);
  const after = content.slice(endIdx);
  
  // Use a helper function approach instead of regex with angle brackets in JSX context
  const fixedClean = `  // Strip HTML from content (handles old data saved as HTML from DOM)
  const stripHtml = (s: string) => s
    .replace(/<br\\s*\\/?>/gi, '\\n')
    .replace(/<div[^>]*>/gi, '\\n')
    .replace(/<\\/div>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
  let cleaned = stripHtml(content).replace(/^[০-৯0-9]+[।.]`;

  content = before + fixedClean + after;
  console.log('✅ Fixed bad HTML strip regex');
} else {
  console.log('⚠️  Bad section not found, startIdx=', startIdx, 'endIdx=', endIdx);
}

// Also fix the rawLines merge section if it has issues
const badMerge = '  // Merge lines that are continuations of math $ expressions (prevent broken fractions/sqrt)\n  // e.g. if a line ends mid-$...$, merge with next line\n  const mergedContent = cleaned\n    // First join lines where previous line ended inside a $ math block (odd number of $)\n    .replace(/([^\\n]*\\$[^\\$\\n]+)\\n([^\\n]*\\$)/g, \'$1 $2\')\n    // Also join lines that are clearly fraction/sqrt continuations (number alone on a line)\n    .replace(/\\n([০-৯0-9]+)\\n/g, \' $1 \');\n  const rawLines = mergedContent.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);';

const goodMerge = `  // Merge lines where math \$ expression may be split across lines (prevents broken fractions)
  const rawLines = cleaned.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);`;

if (content.includes(badMerge)) {
  content = content.replace(badMerge, goodMerge);
  console.log('✅ Simplified rawLines split (removed complex merge that may cause issues)');
}

fs.writeFileSync(path, content, 'utf-8');
console.log('✅ Saved question-bank/page.tsx');
