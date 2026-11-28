import fs from 'fs';

// Fix question-bank/page.tsx — formatContentWithBoardMarks
// Problem: content split on \n breaks math expressions that span multiple lines
// Also fix: marks duplicating when content already has [২] markers embedded
const path = 'src/app/question-bank/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Replace the rawLines line to first normalize multi-line math expressions
const oldSplit = `  const rawLines = cleaned.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);`;
const newSplit = `  // Merge lines that are continuations of math $ expressions (prevent broken fractions/sqrt)
  // e.g. if a line ends mid-$...$, merge with next line
  const mergedContent = cleaned
    // First join lines where previous line ended inside a $ math block (odd number of $)
    .replace(/([^\\n]*\\$[^\\$\\n]+)\\n([^\\n]*\\$)/g, '$1 $2')
    // Also join lines that are clearly fraction/sqrt continuations (number alone on a line)
    .replace(/\\n([০-৯0-9]+)\\n/g, ' $1 ');
  const rawLines = mergedContent.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);`;

if (content.includes(oldSplit)) {
  content = content.replace(oldSplit, newSplit);
  console.log('✅ Fixed: rawLines split now merges broken math lines');
} else {
  console.log('⚠️  oldSplit not found, trying alternate approach...');
  // Try to find approximate location
  const idx = content.indexOf('const rawLines = cleaned.split');
  console.log('Found at:', idx);
}

// Also add a pre-processing step at the top of formatContentWithBoardMarks
// to strip HTML tags that might have been saved from DOM (old data cleanup)
const oldCleaned = `  let cleaned = content.replace(/^[০-৯0-9]+[।.)]\s*/, '').trim();`;
const newCleaned = `  // Strip any HTML tags that might have been saved from DOM (old data cleanup)
  let cleaned = content
    .replace(/<br\s*\/?>/gi, '\\n')
    .replace(/<div[^>]*>/gi, '\\n')
    .replace(/<\/div>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/^[০-৯0-9]+[।.)]\s*/, '')
    .trim();`;

if (content.includes(oldCleaned)) {
  content = content.replace(oldCleaned, newCleaned);
  console.log('✅ Fixed: HTML stripping added to formatContentWithBoardMarks');
} else {
  // Try without exact whitespace
  const altOld = "let cleaned = content.replace(/^[০-৯0-9]+[।.)]\\s*/, '').trim();";
  if (content.includes(altOld)) {
    content = content.replace(altOld, newCleaned);
    console.log('✅ Fixed (alt): HTML stripping added');
  } else {
    console.log('⚠️  Could not find cleaned variable, checking...');
    const idx2 = content.indexOf('let cleaned = content.replace');
    console.log('Found at:', idx2, content.slice(idx2, idx2+100));
  }
}

fs.writeFileSync(path, content, 'utf-8');
console.log('✅ question-bank/page.tsx updated');
