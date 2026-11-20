const fs = require('fs');

// ══════════════════════════════════════════════════════
// PATCH 1: omr-sheet/page.tsx
// - Change title/subtitle inputs to dropdown combos
// - Add "ফলাফল দেখুন" button
// ══════════════════════════════════════════════════════
const p1 = 'C:/Users/dhono/.gemini/antigravity/scratch/mybook/src/app/omr-sheet/page.tsx';
let c1 = fs.readFileSync(p1, 'utf8');

// 1a. Replace title/subtitle inputs with dropdown combos
const oldCustomizer = `        {/* Inline Title / Year / Subtitle Customizer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t text-xs">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">পরীক্ষার শিরোনাম:</label>
            <Input
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="এস এস সি পরীক্ষা- ২০২৭"
              className="h-8 text-xs font-bold mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">উপ-শিরোনাম / বিষয়:</label>
            <Input
              value={examSubtitle}
              onChange={(e) => setExamSubtitle(e.target.value)}
              placeholder="মডেল টেস্ট / গণিত"
              className="h-8 text-xs font-bold mt-0.5"
            />
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
        </div>`;

const newCustomizer = `        {/* Inline Title / Year / Subtitle Customizer */}
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
                  <option key={t} value={t} />
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
                {[...new Set(savedAnswerKeys.filter((k: any) => !examTitle || k.examTitle === examTitle).map((k: any) => k.examSubtitle).filter(Boolean))].map((t: any) => (
                  <option key={t} value={t} />
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
        </div>`;

if (c1.includes(oldCustomizer)) {
  c1 = c1.replace(oldCustomizer, newCustomizer);
  console.log('✅ Dropdown combos added');
} else {
  console.log('❌ Could not find customizer section');
}

// 1b. Add "ফলাফল দেখুন" button after Scan button
const oldScanBtn = `            {/* Scan Button */}
            <Button
              onClick={() => setScannerOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black gap-2 shadow-md h-9 px-4 no-print"
            >
              <Camera className="w-4 h-4" /> মোবাইলে স্ক্যান
            </Button>`;

const newScanBtn = `            {/* Scan Button */}
            <Button
              onClick={() => setScannerOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black gap-2 shadow-md h-9 px-4 no-print"
            >
              <Camera className="w-4 h-4" /> মোবাইলে স্ক্যান
            </Button>

            {/* Results Button */}
            <Button
              onClick={() => router.push('/omr-results')}
              variant="outline"
              className="border-emerald-400 text-emerald-700 hover:bg-emerald-50 font-black gap-2 h-9 px-4 no-print"
            >
              <BarChart2 className="w-4 h-4" /> ফলাফল দেখুন
            </Button>`;

if (c1.includes(oldScanBtn)) {
  c1 = c1.replace(oldScanBtn, newScanBtn);
  console.log('✅ ফলাফল দেখুন button added');
} else {
  console.log('❌ Could not find scan button section');
}

fs.writeFileSync(p1, c1, 'utf8');
console.log('omr-sheet/page.tsx updated. Lines:', c1.split('\n').length);
