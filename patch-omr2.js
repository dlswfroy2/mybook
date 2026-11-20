const fs = require('fs');
const path = 'C:/Users/dhono/.gemini/antigravity/scratch/mybook/src/app/omr-sheet/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Step 2: Add Scan button next to Print button
const printButtonOld = `            {/* Print Button */}
            <Button
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black gap-2 shadow-md h-9 px-4"
            >
              <Printer className="w-4 h-4" /> ওএমআর প্রিন্ট করুন
            </Button>`;

const printButtonNew = `            {/* Print Button */}
            <Button
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black gap-2 shadow-md h-9 px-4 no-print"
            >
              <Printer className="w-4 h-4" /> ওএমআর প্রিন্ট করুন
            </Button>

            {/* Scan Button */}
            <Button
              onClick={() => setScannerOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black gap-2 shadow-md h-9 px-4 no-print"
            >
              <Camera className="w-4 h-4" /> মোবাইলে স্ক্যান
            </Button>`;

content = content.replace(printButtonOld, printButtonNew);

// Step 3: Add Answer Key section after the Inline Title customizer section (after the closing </div> of customizer)
const afterCustomizer = `        </div>
      </div>

      {/* ── Main Printable Sheet Area ── */}`;

const withAnswerKey = `        </div>

        {/* ── Answer Key Setup Section ── */}
        <div className="border-t pt-3 mt-1 no-print">
          <button
            type="button"
            onClick={() => setAnswerKeyOpen(!answerKeyOpen)}
            className="flex items-center gap-2 text-sm font-black text-purple-700 hover:text-purple-900 transition-colors mb-2"
          >
            <Key className="w-4 h-4" />
            উত্তরমালা সেট করুন (Answer Key)
            {answerKeyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="text-xs font-normal text-slate-500 ml-1">
              ({Object.keys(masterAnswerKey).length}/{questionCount} সেট করা হয়েছে)
            </span>
          </button>

          {answerKeyOpen && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-3">
              <p className="text-xs text-slate-600 mb-3 font-medium">
                প্রতিটি প্রশ্নের সঠিক উত্তর বাছাই করুন। স্ক্যানের সময় এই উত্তরমালা ব্যবহার হবে।
              </p>
              <div className="grid gap-y-1.5"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
              >
                {Array.from({ length: questionCount }, (_, i) => i + 1).map((qNum) => (
                  <div key={qNum} className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-600 w-6 text-right shrink-0">{qNum}.</span>
                    <div className="flex gap-1">
                      {['ক', 'খ', 'গ', 'ঘ'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setMasterAnswerKey(prev => {
                              const updated = { ...prev };
                              if (updated[qNum] === opt) {
                                delete updated[qNum];
                              } else {
                                updated[qNum] = opt;
                              }
                              return updated;
                            });
                          }}
                          className={cn(
                            "w-7 h-7 rounded-full text-xs font-black border-2 transition-all",
                            masterAnswerKey[qNum] === opt
                              ? "bg-green-500 border-green-600 text-white shadow-md scale-110"
                              : "bg-white border-slate-300 text-slate-600 hover:border-purple-400 hover:text-purple-700"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setMasterAnswerKey({})}
                  className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 border border-red-200 hover:border-red-400 rounded px-2 py-1 transition-colors"
                >
                  সব মুছুন
                </button>
                <span className="text-xs text-slate-500 flex items-center">
                  মোট {Object.keys(masterAnswerKey).length}টি উত্তর সেট করা হয়েছে
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── OmrScannerDialog ── */}
      <OmrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        questionCount={questionCount}
        examTitle={examTitle}
        examSubtitle={examSubtitle}
        defaultAnswerKey={masterAnswerKey}
      />

      {/* ── Main Printable Sheet Area ── */}`;

content = content.replace(afterCustomizer, withAnswerKey);

fs.writeFileSync(path, content, 'utf8');
const lc = content.split('\n').length;
console.log('Step 2 & 3 done. Total lines:', lc);

// Verify replacements happened
console.log('Has scannerOpen button:', content.includes('setScannerOpen(true)'));
console.log('Has OmrScannerDialog:', content.includes('<OmrScannerDialog'));
console.log('Has answerKeyOpen:', content.includes('answerKeyOpen'));
