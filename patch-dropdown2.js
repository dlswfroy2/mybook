const fs = require('fs');

const p1 = 'C:/Users/dhono/.gemini/antigravity/scratch/mybook/src/app/omr-sheet/page.tsx';
let c1 = fs.readFileSync(p1, 'utf8');

// Replace lines 465-495 (Inline Title / Year / Subtitle Customizer section)
// Using regex to match across CRLF
const oldSection = /\{\/\* Inline Title \/ Year \/ Subtitle Customizer \*\/\}[\s\S]*?<\/div>\s*\n\s*\{\/\* .* Answer Key Setup Section/m;

// Find the index of the comment
const startMarker = '{/* Inline Title / Year / Subtitle Customizer */}';
const endMarker = '{/* ── Answer Key Setup Section ── */}';

const startIdx = c1.indexOf(startMarker);
const endIdx = c1.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('❌ Markers not found. startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

const before = c1.substring(0, startIdx);
const after = c1.substring(endIdx);

const newSection = `{/* Inline Title / Year / Subtitle Customizer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t text-xs">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">পরীক্ষার শিরোনাম:</label>
            <div className="relative mt-0.5">
              <input
                list="examTitleList"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="এস এস সি পরীক্ষা- ২০২৭"
                className="h-8 text-xs font-bold w-full border rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <datalist id="examTitleList">
                {[...new Set(savedAnswerKeys.map((k: any) => k.examTitle).filter(Boolean))].map((t: any) => (
                  <option key={String(t)} value={String(t)} />
                ))}
                <option value="এস এস সি পরীক্ষা- ২০২৭" />
                <option value="জে এস সি পরীক্ষা- ২০২৭" />
                <option value="অর্ধ-বার্ষিক পরীক্ষা- ২০২৬" />
                <option value="বার্ষিক পরীক্ষা- ২০২৬" />
                <option value="মডেল টেস্ট ২০২৭" />
              </datalist>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">উপ-শিরোনাম / বিষয়:</label>
            <div className="relative mt-0.5">
              <input
                list="examSubtitleList"
                value={examSubtitle}
                onChange={(e) => setExamSubtitle(e.target.value)}
                placeholder="মডেল টেস্ট / গণিত"
                className="h-8 text-xs font-bold w-full border rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <datalist id="examSubtitleList">
                {[...new Set(savedAnswerKeys
                  .filter((k: any) => !examTitle || k.examTitle === examTitle)
                  .map((k: any) => k.examSubtitle).filter(Boolean))].map((t: any) => (
                  <option key={String(t)} value={String(t)} />
                ))}
                <option value="বাংলা প্রথম পত্র" />
                <option value="বাংলা দ্বিতীয় পত্র" />
                <option value="ইংরেজি প্রথম পত্র" />
                <option value="ইংরেজি দ্বিতীয় পত্র" />
                <option value="গণিত" />
                <option value="বিজ্ঞান" />
                <option value="সাধারণ বিজ্ঞান" />
                <option value="মডেল টেস্ট" />
              </datalist>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">পূর্ণমান:</label>
            <Input
              value={fullMarks}
              onChange={(e) => setFullMarks(e.target.value)}
              placeholder="৩০"
              className="h-8 text-xs font-bold mt-0.5"
            />
          </div>
        </div>

        `;

c1 = before + newSection + after;
fs.writeFileSync(p1, c1, 'utf8');
console.log('✅ Dropdown combos inserted. Total lines:', c1.split('\n').length);
