const fs = require('fs');
const path = 'C:/Users/dhono/.gemini/antigravity/scratch/mybook/src/app/omr-sheet/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update imports: add Camera, Key, ChevronDown, ChevronUp to lucide-react
content = content.replace(
  "import { Printer, ArrowLeft, Scissors, LayoutGrid, FileText, CheckCircle2, RefreshCw } from 'lucide-react';",
  "import { Printer, ArrowLeft, Scissors, LayoutGrid, FileText, CheckCircle2, RefreshCw, Camera, Key, ChevronDown, ChevronUp } from 'lucide-react';"
);

// 2. Add OmrScannerDialog import
content = content.replace(
  "import { cn } from '@/lib/utils';",
  "import { cn } from '@/lib/utils';\nimport { OmrScannerDialog } from '@/components/OmrScannerDialog';"
);

// 3. Add state variables after fullMarks state
content = content.replace(
  "  const [fullMarks, setFullMarks] = useState('৩০');",
  "  const [fullMarks, setFullMarks] = useState('৩০');\n  const [scannerOpen, setScannerOpen] = useState(false);\n  const [masterAnswerKey, setMasterAnswerKey] = useState({});\n  const [answerKeyOpen, setAnswerKeyOpen] = useState(false);"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Step 1 imports & state done. Lines:', content.split('\n').length);
