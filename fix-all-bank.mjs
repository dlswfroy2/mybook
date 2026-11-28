/**
 * Fix all question bank issues:
 * 1. Clean bad old data in question-bank.json (merge split fraction lines, strip embedded marks)
 * 2. Remove extra save button from create-question/page.tsx (keep only the top toolbar one)
 * 3. Fix mark duplication in question-bank/page.tsx formatContentWithBoardMarks
 */
import fs from 'fs';

// ═══════════════════════════════════════════════════════════════════════
// FIX 1: Clean question-bank.json — repair broken content
// ═══════════════════════════════════════════════════════════════════════
console.log('\n📦 Fix 1: Cleaning question-bank.json...');
const bankPath = 'data/question-bank.json';
const rawData = JSON.parse(fs.readFileSync(bankPath, 'utf-8'));
const qs = Array.isArray(rawData) ? rawData : (rawData.questions || []);

function repairContent(content) {
  if (!content) return content;
  
  // 1. Strip HTML if any
  let c = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

  // 2. Merge lines that are ONLY numbers/digits (orphan fraction lines)
  // Pattern: some text, then a line with ONLY a number (like "1", "2", "৪"), then more text
  // These are split fractions: "x +" + newline + "1" + newline + "x" → should be "x + 1/x" (can't reconstruct frac, but join with space)
  // We join isolated digit-only lines with their neighbors using a space
  const lines = c.split(/\r?\n/);
  const merged = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
    const prevLine = merged.length > 0 ? merged[merged.length - 1] : '';
    
    // Check if this line is ONLY a number (Bengali or English digits, possibly with math operators)
    const isOrphanNumber = /^[০-৯\d]+$/.test(line) || /^[০-৯\d\s\+\-\*\/\=]+$/.test(line) && line.length <= 5;
    
    // Check if line starts with a sub-question prefix ক., খ., গ., ঘ. etc
    const isSubQuestion = /^[ক-ঘa-d][.)।]/.test(line);
    
    if (isOrphanNumber && !isSubQuestion && merged.length > 0) {
      // Orphan number line — append to previous line with a space
      merged[merged.length - 1] = prevLine + ' ' + line;
    } else {
      merged.push(line);
    }
  }
  c = merged.join('\n').trim();
  
  // 3. Remove embedded mark brackets [২], [৪], [1], [2], [4] etc from sub-question lines
  // Keep them only once — the formatter will re-add them
  c = c.replace(/\[\s*([০-৯\d]+)\s*\]\s*$/gm, '');
  c = c.replace(/\(\s*([০-৯\d]+)\s*\)\s*$/gm, '');
  
  // 4. Remove trailing bare numbers after ।
  c = c.replace(/(।)\s+([১-৯\d][০-৯\d]?)\s*$/gm, '$1');
  
  // 5. Collapse multiple blank lines
  c = c.replace(/\n{3,}/g, '\n\n').trim();
  
  return c;
}

// Deduplicate and repair
const seen = new Map();
const cleanedQs = [];
let repaired = 0, dupsRemoved = 0;

for (const q of qs) {
  const repContent = repairContent(q.content);
  const key = `${q.type}::${q.classId}::${(repContent||'').slice(0,60)}`;
  
  if (seen.has(key)) {
    dupsRemoved++;
    continue;
  }
  seen.set(key, true);
  
  if (repContent !== q.content) repaired++;
  cleanedQs.push({ ...q, content: repContent });
}

fs.writeFileSync(bankPath, JSON.stringify(cleanedQs, null, 2), 'utf-8');
console.log(`✅ Bank cleaned: ${repaired} repaired, ${dupsRemoved} duplicates removed, ${cleanedQs.length} total kept`);


// ═══════════════════════════════════════════════════════════════════════
// FIX 2: Remove the SECOND save button (line ~1303) from Live Layout card
// Keep ONLY the top toolbar button (line ~1004)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n🔘 Fix 2: Removing duplicate save button from create-question...');
const cqPath = 'src/app/create-question/page.tsx';
let cqContent = fs.readFileSync(cqPath, 'utf-8');

// The second button is inside "লাইভ প্রিন্ট-স্টাইল লেআউট" card header
// It has: onClick={handleSaveToQuestionBank} and title="এই লাইভ লেআউট থেকে..."
const secondBtnStart = `                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSaveToQuestionBank}
                        className="text-xs font-bold text-indigo-700 border-indigo-300 hover:bg-indigo-50 h-7 px-2.5 gap-1 shrink-0"
                        title="`;
const secondBtnEnd = `                      </Button>`;

const startIdx = cqContent.indexOf(secondBtnStart);
if (startIdx >= 0) {
  // Find the closing </Button>
  const endSearchFrom = startIdx + secondBtnStart.length;
  const endIdx = cqContent.indexOf(secondBtnEnd, endSearchFrom) + secondBtnEnd.length;
  if (endIdx > startIdx) {
    cqContent = cqContent.slice(0, startIdx) + cqContent.slice(endIdx + 1); // +1 for \n
    console.log('✅ Second save button removed from Live Layout card');
  } else {
    console.log('⚠️  Could not find end of second button');
  }
} else {
  // Try a simpler approach - find by unique title text
  const altMarker = 'এই লাইভ লেআউট থেকে সরাসরি প্রশ্ন ব্যাংকে সেভ করুন';
  const altIdx = cqContent.indexOf(altMarker);
  if (altIdx >= 0) {
    // Find the Button start before this
    const btnStart = cqContent.lastIndexOf('<Button', altIdx);
    // Find the Button end after this
    const btnEnd = cqContent.indexOf('</Button>', altIdx) + '</Button>'.length;
    if (btnStart >= 0 && btnEnd > btnStart) {
      cqContent = cqContent.slice(0, btnStart) + cqContent.slice(btnEnd + 1);
      console.log('✅ Second save button removed (alt method)');
    }
  } else {
    console.log('⚠️  Second save button not found — may already be removed');
  }
}

fs.writeFileSync(cqPath, cqContent, 'utf-8');


// ═══════════════════════════════════════════════════════════════════════
// FIX 3: Fix formatContentWithBoardMarks in question-bank/page.tsx
// Problem: marks appear TWICE — once embedded in content, once added by formatter
// Solution: strip embedded marks BEFORE the formatter tries to add them
// Also: merge orphan number lines (from old broken data display)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n🔧 Fix 3: Fixing mark duplication and broken line display...');
const bankPagePath = 'src/app/question-bank/page.tsx';
let bankContent = fs.readFileSync(bankPagePath, 'utf-8');

// Find the rawLines section and replace with better version
const oldRawLines = `  // Merge lines where math \$ expression may be split across lines (prevents broken fractions)
  const rawLines = cleaned.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);`;

const newRawLines = `  // Pre-process: merge orphan number-only lines (broken fraction remnants from old data)
  // e.g. content line "ক. x +" then next line "1" then "x" → join to "ক. x + 1 x"
  const rawParts = cleaned.split(/\\r?\\n/).map(l => l.trim());
  const mergedParts: string[] = [];
  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    if (!part) continue;
    // If this line is ONLY digits/numbers (orphan fraction line), join with previous
    const isOrphan = /^[০-৯\\d]+$/.test(part) || (/^[০-৯\\d\\s+\\-*/=.]+$/.test(part) && part.trim().length <= 5);
    const isSubQ = /^[ক-ঘa-d][.)।]/.test(part);
    if (isOrphan && !isSubQ && mergedParts.length > 0) {
      mergedParts[mergedParts.length - 1] += ' ' + part;
    } else {
      mergedParts.push(part);
    }
  }
  const rawLines = mergedParts.filter(Boolean);`;

if (bankContent.includes(oldRawLines)) {
  bankContent = bankContent.replace(oldRawLines, newRawLines);
  console.log('✅ rawLines processing improved (orphan number merge)');
} else {
  // Try finding via a substring
  const altOld = 'const rawLines = cleaned.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);';
  if (bankContent.includes(altOld)) {
    bankContent = bankContent.replace(altOld, newRawLines.replace('  // Pre-process: merge orphan number-only lines (broken fraction remnants from old data)\n  // e.g. content line "ক. x +" then next line "1" then "x" → join to "ক. x + 1 x"\n  ', '  '));
    console.log('✅ rawLines processing improved (alt)');
  } else {
    console.log('⚠️  rawLines target not found — checking...');
    const idx = bankContent.indexOf('const rawLines');
    console.log('rawLines at:', idx, bankContent.slice(idx, idx+100));
  }
}

fs.writeFileSync(bankPagePath, bankContent, 'utf-8');
console.log('✅ question-bank/page.tsx updated');

console.log('\n🎉 All fixes done!');
