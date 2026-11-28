import fs from 'fs';

// ═══════════════════════════════════════════════════════
// Fix 1: create-question/page.tsx — handleSaveToQuestionBank
// Always use structured questions array, never parse DOM innerText
// ═══════════════════════════════════════════════════════
const createPath = 'src/app/create-question/page.tsx';
let content = fs.readFileSync(createPath, 'utf-8');

const startMarker = '// Save current questions to the central Question Bank (handles live edits from contentEditable!)';
const endMarker = '  const getClassLabel = useCallback';
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx >= 0 && endIdx > startIdx) {
  const before = content.slice(0, startIdx);
  const after = content.slice(endIdx);
  const newFunc = `// Save current questions to the central Question Bank
  // ALWAYS uses structured questions array — never parses DOM/innerText → prevents math breakage & double-save
  const handleSaveToQuestionBank = () => {
    const list = activeSet === 'A' ? questions : questionsB;
    if (!list || list.length === 0) {
      toast({
        variant: 'destructive',
        title: 'কোনো প্রশ্ন নেই',
        description: 'প্রশ্ন ব্যাংকে সংরক্ষণ করার জন্য প্রথমে প্রশ্ন তৈরি বা যোগ করুন।'
      });
      return;
    }
    const itemsToSave = list.map(q => ({
      classId: String(meta.classId || '10'),
      subject: meta.subject || 'সাধারণ',
      chapter: meta.chapter || '১ম অধ্যায়',
      type: (q.type === 'mcq' ? 'mcq' : q.type === 'short' ? 'short' : 'creative'),
      content: q.content,
      options: q.options || [],
      source: 'create-question'
    }));
    const result = addQuestionsToBank(itemsToSave, db);
    toast({
      title: 'প্রশ্ন ব্যাংকে সংরক্ষিত! 📥',
      description: \`মোট \${toBengaliNumber(result.addedCount)}টি প্রশ্ন সফলভাবে সংরক্ষিত হয়েছে।\`
    });
  };

  `;
  fs.writeFileSync(createPath, before + newFunc + after, 'utf-8');
  console.log('✅ Fixed: create-question handleSaveToQuestionBank');
} else {
  console.log('⚠️  Marker not found in create-question. start=', startIdx, 'end=', endIdx);
}

// ═══════════════════════════════════════════════════════
// Fix 2: QuestionPrintView.tsx — handleSaveToQuestionBankFromWord
// Always use structured questions prop, never parse DOM .content-area
// ═══════════════════════════════════════════════════════
const printPath = 'src/components/QuestionPrintView.tsx';
let pContent = fs.readFileSync(printPath, 'utf-8');

const pStartMarker = '  // Direct save from Word-like editor into Question Bank (captures live edited DOM)';
const pEndMarker = '\n  // '; // next comment after the function
const pStartIdx = pContent.indexOf(pStartMarker);

// Find end: the closing }; of the function
let braceDepth = 0;
let funcEnd = -1;
let inFunc = false;
for (let i = pStartIdx; i < pContent.length; i++) {
  if (pContent[i] === '{') { braceDepth++; inFunc = true; }
  if (pContent[i] === '}') { braceDepth--; }
  if (inFunc && braceDepth === 0) { funcEnd = i + 1; break; }
}

if (pStartIdx >= 0 && funcEnd > pStartIdx) {
  const pBefore = pContent.slice(0, pStartIdx);
  const pAfter = pContent.slice(funcEnd);
  const newPFunc = `  // Direct save from Word-like editor into Question Bank
  // ALWAYS uses structured questions prop — never parses DOM .content-area → prevents math breakage & double-save
  const handleSaveToQuestionBankFromWord = () => {
    try {
      if (!questions || questions.length === 0) {
        toast({
          variant: 'destructive',
          title: 'কোনো প্রশ্ন পাওয়া যায়নি',
          description: 'প্রশ্ন ব্যাংকে সংরক্ষণ করার জন্য উপযুক্ত প্রশ্ন টেক্সট প্রয়োজন।'
        });
        return;
      }

      const itemsToSave = questions.map(q => ({
        classId: String(saveClassId || meta.classId || '10'),
        subject: saveSubject || meta.subject || 'সাধারণ',
        chapter: saveChapter || meta.chapter || '১ম অধ্যায়',
        type: (q.type === 'mcq' ? 'mcq' : q.type === 'short' ? 'short' : 'creative'),
        content: q.content,
        options: q.options || [],
        source: 'word-editor'
      }));

      const res = addQuestionsToBank(itemsToSave);
      toast({
        title: 'প্রশ্ন ব্যাংকে সংরক্ষিত! 📥',
        description: \`মোট \${toBengaliNumber(res.addedCount)}টি প্রশ্ন কেন্দ্রীয় ক্লাউড সার্ভার ও প্রশ্ন ব্যাংকে সফলভাবে সংরক্ষিত হয়েছে।\`
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'সংরক্ষণ ব্যর্থ হয়েছে',
        description: err.message || 'প্রশ্ন ব্যাংকে সেভ করা যায়নি।'
      });
    }
  };`;
  fs.writeFileSync(printPath, pBefore + newPFunc + pAfter, 'utf-8');
  console.log('✅ Fixed: QuestionPrintView handleSaveToQuestionBankFromWord');
} else {
  console.log('⚠️  Marker not found in QuestionPrintView. start=', pStartIdx, 'funcEnd=', funcEnd);
}

// ═══════════════════════════════════════════════════════
// Fix 3: question-bank-storage.ts — Add content-based deduplication
// ═══════════════════════════════════════════════════════
const storagePath = 'src/lib/question-bank-storage.ts';
let sContent = fs.readFileSync(storagePath, 'utf-8');

// Find the deduplication section right before 'existing.push(newQuestion)'
const dupCheck = `    // Dedup: skip if same type+subject+chapter+class and first 60 chars of content match
    const contentKey = normalizeText(cleanContent).substring(0, 60);
    const isDuplicate = existing.some(q =>
      String(q.classId).trim() === cleanClass &&
      normalizeText(q.subject) === normalizeText(cleanSubj) &&
      normalizeText(q.chapter) === normalizeText(cleanChap) &&
      q.type === cleanType &&
      normalizeText(q.content).substring(0, 60) === contentKey
    );
    if (isDuplicate) {
      console.log('[QuestionBank] Skipping duplicate question:', cleanContent.substring(0, 40));
      continue;
    }

    `;

const pushTarget = '    existing.push(newQuestion);';
if (!sContent.includes(dupCheck)) {
  sContent = sContent.replace(pushTarget, dupCheck + pushTarget);
  fs.writeFileSync(storagePath, sContent, 'utf-8');
  console.log('✅ Fixed: question-bank-storage.ts deduplication added');
} else {
  console.log('ℹ️  Deduplication already present in storage');
}

console.log('\n🎉 All fixes applied!');
