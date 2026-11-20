const fs = require('fs');

// Fix 1: OmrScannerDialog.tsx - add cn import
const p1 = 'C:/Users/dhono/.gemini/antigravity/scratch/mybook/src/components/OmrScannerDialog.tsx';
let c1 = fs.readFileSync(p1, 'utf8');
if (!c1.includes("import { cn } from '@/lib/utils';")) {
  c1 = c1.replace(
    "import React, { useState, useRef, useMemo } from 'react';",
    "import React, { useState, useRef, useMemo } from 'react';\nimport { cn } from '@/lib/utils';"
  );
  fs.writeFileSync(p1, c1, 'utf8');
  console.log('OmrScannerDialog cn import added');
} else {
  console.log('OmrScannerDialog already has cn');
}

// Fix 2: omr-sheet/page.tsx - fix type annotation
const p2 = 'C:/Users/dhono/.gemini/antigravity/scratch/mybook/src/app/omr-sheet/page.tsx';
let c2 = fs.readFileSync(p2, 'utf8');
c2 = c2.replace(
  'const [masterAnswerKey, setMasterAnswerKey] = useState({});',
  'const [masterAnswerKey, setMasterAnswerKey] = useState<Record<number, string>>({});'
);
fs.writeFileSync(p2, c2, 'utf8');
console.log('masterAnswerKey type fixed');
