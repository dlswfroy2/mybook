
"use client";

import { useState, useEffect, Suspense, useMemo, useRef, useCallback } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Printer, 
  Save, 
  FileText, 
  ArrowLeft, 
  Loader2, 
  BookOpen, 
  ScanText, 
  Eye, 
  Settings2, 
  SlidersHorizontal, 
  Image as ImageIcon, 
  X, 
  Type, 
  Bold, 
  Underline, 
  Italic, 
  Rows3, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  Edit3, 
  FileDown, 
  Trash2, 
  PlusCircle, 
  CheckCircle2, 
  Camera,
  FileUp,
  FileType,
  BrainCircuit,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateLectureSheet } from '@/ai/flows/generate-lecture-sheet-flow';
import { useFirestore, useUser, useDoc, useStorage } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { performAiOcr } from '@/ai/flows/ocr-flow';
import { WordToolbar } from '@/components/WordToolbar';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function stripDirtyHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  if (!html) return '';

  // 1. Repair any corrupted artifacts like <="" span=""> or </span"> or ="" created previously
  let cleaned = html
    .replace(/<=""\s*span="">/gi, '')
    .replace(/<\/span">/gi, '')
    .replace(/<span\s+a<=""\s*span="">/gi, '')
    .replace(/=""/g, '')
    .replace(/data-index-in-node="[^"]*"/gi, '')
    .replace(/ba\\right\)\^n/g, '(ab)^n')
    .replace(/\\right\)/g, ')')
    .replace(/=\s*"([a-zA-Z0-9^_+-\s]+)"/g, '= $1')
    .replace(/"\s*\\frac/g, '\\frac');

  if (!/<[a-z][\s\S]*>/i.test(cleaned)) return cleaned;

  // 2. Parse cleanly into DOM without destructive tag regex
  const tmp = document.createElement('div');
  tmp.innerHTML = cleaned;

  // 3. Use standard DOM API to clean up elements
  tmp.querySelectorAll('*').forEach((el) => {
    // Keep KaTeX, tables, and math structures intact
    if (
      el.classList.contains('katex') ||
      el.closest('.katex') ||
      el.classList.contains('math-frac') ||
      el.closest('.math-frac') ||
      el.tagName === 'TABLE' ||
      el.tagName === 'TR' ||
      el.tagName === 'TD' ||
      el.tagName === 'TH'
    ) {
      return;
    }

    // Safely remove any Gemini data attributes or event handlers
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('data-') || attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });

    // Clean Gemini junk styles (margin-top: 0px !important, line-height: 1.15 !important)
    if (el.hasAttribute('style')) {
      const s = el.getAttribute('style') || '';
      if (s.includes('line-height: 1.15') || s.includes('margin-top: 0px') || s.includes('margin-left: 0px')) {
        const cleanedStyle = s
          .replace(/margin-(top|left|right|bottom):\s*0px\s*!important;?/gi, '')
          .replace(/line-height:\s*1\.15\s*!important;?/gi, '')
          .trim();
        if (cleanedStyle) {
          el.setAttribute('style', cleanedStyle);
        } else {
          el.removeAttribute('style');
        }
      }
    }
  });

  tmp.querySelectorAll('meta, script').forEach((el) => el.remove());
  return tmp.innerHTML;
}

function formatMath(text: string): string {
  if (!text) return '';
  text = stripDirtyHtml(text);

  // If text already contains KaTeX HTML, return directly without running regex
  if (text.includes('class="katex"') || text.includes("class='katex'")) {
    return text;
  }

  // Convert $$ ... $$ (display math) with output: 'html' (prevents unstyled MathML stacking)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: true, output: 'html' });
    } catch {
      return `$$${math}$$`;
    }
  });

  // Convert $ ... $ (inline math) with output: 'html'
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return `$${math}$`;
    }
  });

  // Convert \[ ... \] and \( ... \)
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: true, output: 'html' });
    } catch {
      return math;
    }
  });
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return math;
    }
  });

  // Convert standalone \frac{...}{...}
  if (/\\frac\{/.test(text)) {
    text = text.replace(/\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_, num, den) => {
      try {
        return katex.renderToString(`\\frac{${num}}{${den}}`, { throwOnError: false, displayMode: false, output: 'html' });
      } catch {
        return `<span class="math-frac"><span class="math-num">${num}</span><span class="math-den">${den}</span></span>`;
      }
    });
  }

  // Convert standalone \sqrt
  if (/\\sqrt/.test(text)) {
    text = text.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, (_, root, val) => {
      try {
        return katex.renderToString(`\\sqrt[${root}]{${val}}`, { throwOnError: false, displayMode: false, output: 'html' });
      } catch {
        return `<sup>${root}</sup>√<span>${val}</span>`;
      }
    });
    text = text.replace(/\\sqrt\{([^}]+)\}/g, (_, val) => {
      try {
        return katex.renderToString(`\\sqrt{${val}}`, { throwOnError: false, displayMode: false, output: 'html' });
      } catch {
        return `√<span>${val}</span>`;
      }
    });
  }

  return text;
}

async function processWatermarkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSide = 800;
        let width = img.width;
        let height = img.height;
        if (width > height) { if (width > maxSide) { height *= maxSide / width; width = maxSide; } }
        else { if (height > maxSide) { width *= maxSide / height; height = maxSide; } }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

function isCursorAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  try {
    const preRange = document.createRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().trim().length === 0;
  } catch {
    return false;
  }
}

function isCursorAtEnd(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  try {
    const postRange = document.createRange();
    postRange.selectNodeContents(el);
    postRange.setStart(range.endContainer, range.endOffset);
    return postRange.toString().trim().length === 0;
  } catch {
    return false;
  }
}

function setCursor(el: HTMLElement, position: 'start' | 'end') {
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(position === 'start');
  sel.removeAllRanges();
  sel.addRange(range);
}

interface EditableContentAreaProps {
  initialHtml: string;
  style: any;
  cols: number;
  hasRule: boolean;
  isActive: boolean;
  pageIndex: number;
  totalPages: number;
  onFocus: () => void;
  onClick: () => void;
  onBlur: (val: string) => void;
  onAddNextPage: (initialContent?: string) => void;
  onRemoveEmptyPage: (pageIndex: number) => void;
  onFocusPage: (pageIndex: number, position: 'start' | 'end') => void;
  onSyncPageContent: (pageIndex: number, content: string) => void;
}

function EditableContentArea({
  initialHtml,
  style,
  cols,
  hasRule,
  isActive,
  pageIndex,
  totalPages,
  onFocus,
  onClick,
  onBlur,
  onAddNextPage,
  onRemoveEmptyPage,
  onFocusPage,
  onSyncPageContent,
}: EditableContentAreaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isLoadedRef = useRef(false);
  const isReflowingRef = useRef(false);
  const inputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dynamic Word-like auto-reflow (overflow to next page & pull-up on underflow)
  const checkAndReflow = useCallback((allowUnderflow = false) => {
    if (isReflowingRef.current) return;
    const el = ref.current;
    if (!el) return;
    const maxH = el.clientHeight;
    if (!maxH || maxH <= 0) return;

    isReflowingRef.current = true;

    try {
      // If content is wrapped in a single container element, unwrap it so individual paragraphs/questions can flow
      if (el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === Node.ELEMENT_NODE) {
        const wrapper = el.firstChild as HTMLElement;
        if (wrapper.tagName === 'DIV' || wrapper.tagName === 'P' || wrapper.tagName === 'SECTION' || wrapper.tagName === 'ARTICLE') {
          if (wrapper.childNodes.length > 1) {
            while (wrapper.firstChild) {
              el.insertBefore(wrapper.firstChild, wrapper);
            }
            el.removeChild(wrapper);
          }
        }
      }

      // 1. OVERFLOW: content exceeds available page clientHeight
      if (el.scrollHeight > maxH + 3) {
        const overflowNodes: Node[] = [];

        // Remove last child nodes until content fits inside maxH
        while (el.scrollHeight > maxH + 3 && el.childNodes.length > 1) {
          const last = el.lastChild;
          if (!last) break;
          el.removeChild(last);
          overflowNodes.unshift(last);
        }

        // If single large child remains and still overflows (e.g. a large div or table), extract its child nodes
        if (el.scrollHeight > maxH + 3 && el.firstChild && el.firstChild.nodeType === Node.ELEMENT_NODE) {
          const onlyChild = el.firstChild as HTMLElement;
          if (onlyChild.childNodes.length > 1) {
            const innerOverflow: Node[] = [];
            while (el.scrollHeight > maxH + 3 && onlyChild.childNodes.length > 1) {
              const last = onlyChild.lastChild;
              if (!last) break;
              onlyChild.removeChild(last);
              innerOverflow.unshift(last);
            }
            if (innerOverflow.length > 0) {
              const clone = onlyChild.cloneNode(false) as HTMLElement;
              innerOverflow.forEach((n) => clone.appendChild(n));
              overflowNodes.unshift(clone);
            }
          }
        }

        if (overflowNodes.length > 0) {
          const tempDiv = document.createElement('div');
          overflowNodes.forEach((node) => tempDiv.appendChild(node));
          const overflowHtml = tempDiv.innerHTML;

          const nextEl = document.querySelector(`.paper-idx-${pageIndex + 1} .content-area`) as HTMLDivElement | null;
          if (nextEl) {
            const frag = document.createRange().createContextualFragment(overflowHtml);
            if (nextEl.firstChild) {
              nextEl.insertBefore(frag, nextEl.firstChild);
            } else {
              nextEl.appendChild(frag);
            }
            onSyncPageContent(pageIndex, el.innerHTML);
            onSyncPageContent(pageIndex + 1, nextEl.innerHTML);
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('reflow-page', { detail: { pageIndex: pageIndex + 1 } }));
            }, 30);
          } else {
            onSyncPageContent(pageIndex, el.innerHTML);
            onAddNextPage(overflowHtml);
          }
        }
      }
      // 2. UNDERFLOW: empty space available in this page, pull up from next page (ONLY when allowed, e.g. after Backspace/Delete)
      else if (allowUnderflow && maxH - el.scrollHeight > 35) {
        const nextEl = document.querySelector(`.paper-idx-${pageIndex + 1} .content-area`) as HTMLDivElement | null;
        if (nextEl && nextEl.childNodes.length > 0) {
          let movedCount = 0;
          while (nextEl.childNodes.length > 0 && maxH - el.scrollHeight > 15) {
            const firstNode = nextEl.firstChild!;
            el.appendChild(firstNode);
            if (el.scrollHeight > maxH + 2) {
              // Exceeded, put back
              nextEl.insertBefore(firstNode, nextEl.firstChild);
              break;
            }
            movedCount++;
          }
          if (movedCount > 0) {
            onSyncPageContent(pageIndex, el.innerHTML);
            onSyncPageContent(pageIndex + 1, nextEl.innerHTML);
            // If next page is completely empty and it is the last page, remove it
            if (nextEl.innerText.trim() === '' && nextEl.innerHTML.replace(/<[^>]*>/g, '').trim() === '') {
              if (pageIndex + 1 === totalPages - 1 && totalPages > 1) {
                onRemoveEmptyPage(pageIndex + 1);
              }
            } else {
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('reflow-page', { detail: { pageIndex: pageIndex + 1, allowUnderflow: true } }));
              }, 30);
            }
          }
        }
      }
    } finally {
      isReflowingRef.current = false;
    }
  }, [pageIndex, totalPages, onAddNextPage, onRemoveEmptyPage, onSyncPageContent]);

  // Listen to custom reflow-page events dispatched from adjacent pages
  useEffect(() => {
    const handleReflowEvent = (e: any) => {
      if (e.detail?.pageIndex === pageIndex) {
        checkAndReflow(e.detail?.allowUnderflow || false);
      }
    };
    window.addEventListener('reflow-page', handleReflowEvent);
    return () => window.removeEventListener('reflow-page', handleReflowEvent);
  }, [pageIndex, checkAndReflow]);

  // Load initial content once on mount, then trigger initial reflow check including font readiness
  useEffect(() => {
    if (ref.current && !isLoadedRef.current) {
      ref.current.innerHTML = stripDirtyHtml(initialHtml);
      isLoadedRef.current = true;
      setTimeout(() => checkAndReflow(false), 100);
      if (typeof document !== 'undefined' && document.fonts) {
        document.fonts.ready.then(() => {
          setTimeout(() => checkAndReflow(false), 50);
        });
      }
    }
  }, []);

  // plain text থেকে LaTeX সহ HTML তৈরি করে (KaTeX render সহ, output: 'html')
  const renderMathInText = (text: string): string => {
    // Clean any broken artifacts from text
    let clean = text
      .replace(/<=""\s*span="">/gi, '')
      .replace(/<\/span">/gi, '')
      .replace(/=""/g, '');

    const lines = clean.split('\n');
    const htmlLines = lines.map((line) => {
      if (line.trim() === '') return '<p style="margin:0 0 4px 0;padding:0"><br/></p>';
      // $$ ... $$ (display math)
      line = line.replace(/\$\$(.+?)\$\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), { throwOnError: false, displayMode: true, output: 'html' });
        } catch {
          return `<span>$$${math}$$</span>`;
        }
      });
      // $ ... $ (inline math)
      line = line.replace(/\$([^$\n]+?)\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
        } catch {
          return `<span>$${math}$</span>`;
        }
      });
      // \[ ... \] and \( ... \)
      line = line.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), { throwOnError: false, displayMode: true, output: 'html' });
        } catch {
          return math;
        }
      });
      line = line.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
        } catch {
          return math;
        }
      });
      // Standalone \frac without $
      if (/\\frac\{/.test(line)) {
        line = line.replace(/\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_, num, den) => {
          try {
            return katex.renderToString(`\\frac{${num}}{${den}}`, { throwOnError: false, displayMode: false, output: 'html' });
          } catch {
            return `<span class="math-frac"><span class="math-num">${num}</span><span class="math-den">${den}</span></span>`;
          }
        });
      }
      return `<p style="margin:0 0 4px 0;padding:0">${line}</p>`;
    });
    return htmlLines.join('');
  };

  // Paste হলে clean LaTeX / formatted paragraphs পেস্ট করুন এবং সাথে সাথে reflow করুন
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    const htmlData = clipboardData.getData('text/html');
    const plainText = clipboardData.getData('text/plain');

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();

    const isGemini = htmlData && (htmlData.includes('data-index-in-node') || htmlData.includes('line-height: 1.15'));

    // 1. If text has LaTeX ($...$ or \[...\] or \frac) OR is from Gemini: ALWAYS use plainText + KaTeX
    if (plainText && (isGemini || /\$/.test(plainText) || /\\frac\{/.test(plainText) || /\\sqrt/.test(plainText) || /\\times/.test(plainText))) {
      const renderedHtml = renderMathInText(plainText);
      const fragment = range.createContextualFragment(renderedHtml);
      range.insertNode(fragment);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      setTimeout(() => checkAndReflow(false), 40);
      return;
    }

    // 2. If rich HTML is present (e.g. from Word or web with tables): preserve formatting!
    if (htmlData && /<(table|ul|ol|h[1-6]|b|strong|i|em)[^>]*>/i.test(htmlData)) {
      const cleanHtml = stripDirtyHtml(htmlData);
      const fragment = range.createContextualFragment(cleanHtml);
      range.insertNode(fragment);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      setTimeout(() => checkAndReflow(false), 40);
      return;
    }

    // 3. Plain text fallback: wrap lines in <p>
    if (plainText) {
      const lines = plainText.split('\n');
      const frag = document.createDocumentFragment();
      lines.forEach((line) => {
        const p = document.createElement('p');
        p.style.margin = '0 0 4px 0';
        p.textContent = line || '\u00A0';
        frag.appendChild(p);
      });
      range.insertNode(frag);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      setTimeout(() => checkAndReflow(false), 40);
    }
  };

  const handleInput = () => {
    if (inputTimerRef.current) clearTimeout(inputTimerRef.current);
    inputTimerRef.current = setTimeout(() => {
      checkAndReflow();
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;

    // 1. Support Tab / Shift+Tab to navigate table cells or add rows
    if (e.key === 'Tab') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.anchorNode) {
        let node: Node | null = sel.anchorNode;
        let currentTd: HTMLTableCellElement | null = null;
        while (node && node !== e.currentTarget) {
          if (node.nodeName === 'TD' || node.nodeName === 'TH') {
            currentTd = node as HTMLTableCellElement;
            break;
          }
          node = node.parentNode;
        }
        if (currentTd) {
          e.preventDefault();
          const table = currentTd.closest('table');
          if (!table) return;
          const allCells = Array.from(table.querySelectorAll('td, th'));
          const currentIndex = allCells.indexOf(currentTd);
          if (e.shiftKey) {
            if (currentIndex > 0) {
              const prevCell = allCells[currentIndex - 1] as HTMLElement;
              prevCell.focus();
              const r = document.createRange();
              r.selectNodeContents(prevCell);
              r.collapse(false);
              sel.removeAllRanges();
              sel.addRange(r);
            }
          } else {
            if (currentIndex < allCells.length - 1) {
              const nextCell = allCells[currentIndex + 1] as HTMLElement;
              nextCell.focus();
              const r = document.createRange();
              r.selectNodeContents(nextCell);
              r.collapse(false);
              sel.removeAllRanges();
              sel.addRange(r);
            } else {
              const tr = currentTd.closest('tr');
              if (tr) {
                const colCount = tr.children.length;
                const newTr = document.createElement('tr');
                for (let i = 0; i < colCount; i++) {
                  const newTd = document.createElement('td');
                  newTd.style.border = '1px solid #333';
                  newTd.style.padding = '8px 10px';
                  newTd.style.minWidth = '40px';
                  newTd.style.verticalAlign = 'top';
                  newTd.innerHTML = '<br/>';
                  newTr.appendChild(newTd);
                }
                tr.parentNode?.appendChild(newTr);
                const firstNewCell = newTr.firstElementChild as HTMLElement;
                if (firstNewCell) {
                  firstNewCell.focus();
                  const r = document.createRange();
                  r.selectNodeContents(firstNewCell);
                  r.collapse(false);
                  sel.removeAllRanges();
                  sel.addRange(r);
                }
              }
            }
          }
          return;
        }
      }
    }

    // 2. Enter at bottom of page -> transition to next page
    if (e.key === 'Enter') {
      const isEnd = isCursorAtEnd(el);
      const isFull = el.scrollHeight >= el.clientHeight - 10;
      if (isEnd && isFull) {
        e.preventDefault();
        if (pageIndex < totalPages - 1) {
          onFocusPage(pageIndex + 1, 'start');
        } else {
          onAddNextPage('<p><br/></p>');
          setTimeout(() => onFocusPage(pageIndex + 1, 'start'), 80);
        }
        return;
      }
      setTimeout(() => checkAndReflow(false), 50);
      return;
    }

    // 3. ArrowDown at bottom of page -> move cursor to next page
    if (e.key === 'ArrowDown') {
      if (isCursorAtEnd(el) && pageIndex < totalPages - 1) {
        e.preventDefault();
        onFocusPage(pageIndex + 1, 'start');
        return;
      }
    }

    // 4. ArrowUp at top of page -> move cursor to previous page
    if (e.key === 'ArrowUp') {
      if (isCursorAtStart(el) && pageIndex > 0) {
        e.preventDefault();
        onFocusPage(pageIndex - 1, 'end');
        return;
      }
    }

    // 5. Backspace at top of page -> pull to previous page / delete empty page
    if (e.key === 'Backspace') {
      if (isCursorAtStart(el) && pageIndex > 0) {
        e.preventDefault();
        onFocusPage(pageIndex - 1, 'end');
        if (el.innerText.trim() === '' && el.querySelectorAll('img, table').length === 0) {
          onRemoveEmptyPage(pageIndex);
        } else {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('reflow-page', { detail: { pageIndex: pageIndex - 1, allowUnderflow: true } }));
          }, 50);
        }
        return;
      }
      setTimeout(() => checkAndReflow(true), 100);
      return;
    }

    if (e.key === 'Delete') {
      setTimeout(() => checkAndReflow(true), 100);
    }
  };

  return (
    <div
      ref={ref}
      contentEditable={true}
      suppressContentEditableWarning={true}
      onFocus={onFocus}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onInput={handleInput}
      onPaste={handlePaste}
      onBlur={(e) => {
        const val = e.currentTarget.innerHTML;
        onBlur(val);
      }}
      className={cn(
        "content-area flex-1 font-kalpurush outline-none overflow-hidden",
        isActive && "bg-blue-50/15 ring-1 ring-blue-300 rounded"
      )}
      style={{
        lineHeight: String(style.lineHeight),
        fontSize: `${style.fontSize}pt`,
        fontWeight: style.bold ? 'bold' : 'normal',
        fontStyle: style.italic ? 'italic' : 'normal',
        textDecoration: style.underline ? 'underline' : 'none',
        color: style.color,
        textAlign: style.align as any,
        minHeight: 0,
        maxHeight: '100%',
        columnCount: cols > 1 ? cols : undefined,
        columnGap: cols > 1 ? '0.35in' : undefined,
        columnRule: (cols > 1 && hasRule) ? '1.5px solid #000' : undefined
      }}
    />
  );
}

function CreateLectureSheetContent() {
  const db = useFirestore();
  const storage = useStorage();
  const { user, loading: userLoading } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('id');
  const isPrintMode = searchParams.get('print') === 'true';
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  
  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);

  const [data, setData] = useState({
    institution: 'টপ গ্রেড টিউটোরিয়ালস',
    classId: '',
    subject: '',
    topic: '',
    content: '',
    type: 'lecture_sheet'
  });

  // AI Lecture Sheet Generation States
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiClassId, setAiClassId] = useState<string>('9');
  const [aiSubject, setAiSubject] = useState<string>('পদার্থ');
  const [aiChapter, setAiChapter] = useState('');
  const [aiSheetType, setAiSheetType] = useState<'lecture_sheet' | 'creative' | 'model_test' | 'mcq' | 'answer_key'>('lecture_sheet');
  const [aiCustomTopic, setAiCustomTopic] = useState('');
  const [editorViewMode, setEditorViewMode] = useState<'visual' | 'code'>('visual');

  const handleGenerateAiSheet = async () => {
    if (!aiClassId || !aiSubject || !aiChapter.trim()) {
      toast({
        variant: 'destructive',
        title: 'অসম্পূর্ণ তথ্য',
        description: 'শ্রেণি, বিষয় এবং অধ্যায়ের নাম নির্বাচন করুন।',
      });
      return;
    }

    setAiGenerating(true);
    try {
      const result = await generateLectureSheet({
        className: aiClassId,
        subject: aiSubject,
        chapter: aiChapter.trim(),
        sheetType: aiSheetType,
        topic: aiCustomTopic.trim(),
        institutionName: data.institution,
      });

      // Construct a beautifully formatted lecture sheet
      let generatedDoc = `<h3><strong>${result.title || `${aiSubject} - ${aiChapter}`}</strong></h3>\n\n`;
      if (result.summary) {
        generatedDoc += `<p><strong>পাঠের সারসংক্ষেপ:</strong> ${result.summary}</p>\n\n`;
      }
      if (result.keyConcepts && result.keyConcepts.length > 0) {
        generatedDoc += `<h4><strong>মূল আলোচ্য বিষয় ও সংজ্ঞাসমূহ:</strong></h4>\n`;
        result.keyConcepts.forEach((c) => {
          generatedDoc += `<p>• <strong>${c.heading}:</strong> ${c.details}</p>\n`;
        });
        generatedDoc += `\n`;
      }
      if (result.formulasOrRules && result.formulasOrRules.length > 0) {
        generatedDoc += `<h4><strong>প্রয়োজনীয় সূত্র ও নিয়মাবলী:</strong></h4>\n`;
        result.formulasOrRules.forEach((f) => {
          generatedDoc += `<p>✓ ${f}</p>\n`;
        });
        generatedDoc += `\n`;
      }
      if (result.solvedExamples && result.solvedExamples.length > 0) {
        generatedDoc += `<h4><strong>নমুনা সমস্যা ও সমাধান:</strong></h4>\n`;
        result.solvedExamples.forEach((ex, i) => {
          generatedDoc += `<p><strong>উদাহরণ ${toBengaliNumber(i + 1)}:</strong> ${ex.question}<br/><em>সমাধান:</em> ${ex.solution}</p>\n`;
        });
        generatedDoc += `\n`;
      }
      if (result.practiceTasks && result.practiceTasks.length > 0) {
        generatedDoc += `<h4><strong>অনুশীলন কাজ ও বাড়ির পড়া:</strong></h4>\n`;
        result.practiceTasks.forEach((t, i) => {
          generatedDoc += `<p>${toBengaliNumber(i + 1)}. ${t}</p>\n`;
        });
      }

      setData((prev) => ({
        ...prev,
        classId: aiClassId,
        subject: aiSubject,
        type: aiSheetType,
        topic: aiChapter.trim(),
        content: generatedDoc.trim(),
      }));

      setAiModalOpen(false);
      toast({
        title: 'লেকচার শিট তৈরি সফল! 🎉',
        description: 'এনসিটিবি স্ট্যান্ডার্ড অনুযায়ী লেকচার শিট তৈরি হয়েছে।',
      });
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'ব্যর্থ হয়েছে',
        description: err.message || 'লেকচার শিট তৈরি করা যায়নি।',
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const [printSettings, setPrintSettings] = useState<any>({
    marginTop: 0.5, marginBottom: 0.5, marginLeft: 0.5, marginRight: 0.5,
    watermarkOpacity: 10, watermarkText: '', watermarkFontSize: 80, watermarkRotation: -45,
    watermarkImageUrl: '', watermarkImageSize: 70, watermarkType: 'text'
  });

  const [activeCreationMode, setActiveCreationMode] = useState<'text' | 'pdf'>('text');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [paginatedPages, setPaginatedPages] = useState<string[]>([]);
  const [pageStyles, setPageStyles] = useState<Record<number, any>>({});
  const [activeEditIdx, setActiveEditIdx] = useState<number | null>(0);
  const [manualPages, setManualPages] = useState<Record<number, string>>({});
  const [globalFontSize, setGlobalFontSize] = useState(10.5);
  const [globalLineHeight, setGlobalLineHeight] = useState(1.2);
  const [fontSizeDraft, setFontSizeDraft] = useState("");
  const [lineHeightDraft, setLineHeightDraft] = useState("");
  const [previewZoom, setPreviewZoom] = useState(100);

  useEffect(() => {
    if (!editId) {
      const classIdParam = searchParams.get('classId');
      const subjectParam = searchParams.get('subject');
      const topicParam = searchParams.get('topic');
      if (classIdParam || subjectParam || topicParam) {
        setData(prev => ({ ...prev, classId: classIdParam || prev.classId, subject: subjectParam || prev.subject, topic: topicParam || prev.topic }));
      }
    }
  }, [searchParams, editId]);

  useEffect(() => { if (!userLoading && !user) router.push('/auth'); }, [user, userLoading, router]);
  
  useEffect(() => {
    async function loadSheet() {
      if (!editId || !db || !user) {
        if (!editId) setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'lecture-sheets', editId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const docData = docSnap.data();
          const cleanContent = stripDirtyHtml(docData.content || '');
          setData({
            institution: docData.institution || 'টপ গ্রেড টিউটোরিয়ালস',
            classId: docData.classId || '',
            subject: docData.subject || '',
            topic: docData.topic || '',
            content: cleanContent,
            type: docData.type || 'lecture_sheet'
          });
          if (docData.printSettings) setPrintSettings((prev: any) => ({ ...prev, ...docData.printSettings }));
          if (docData.pageStyles) {
            setPageStyles(docData.pageStyles);
            if (docData.pageStyles[0]?.fontSize) { setGlobalFontSize(docData.pageStyles[0].fontSize); setFontSizeDraft(String(docData.pageStyles[0].fontSize)); }
            if (docData.pageStyles[0]?.lineHeight) { setGlobalLineHeight(docData.pageStyles[0].lineHeight); setLineHeightDraft(String(docData.pageStyles[0].lineHeight)); }
          }
          if (docData.manualPages) {
            const cleanedManual: Record<number, string> = {};
            Object.keys(docData.manualPages).forEach(k => {
              cleanedManual[Number(k)] = stripDirtyHtml(docData.manualPages[Number(k)]);
            });
            setManualPages(cleanedManual);
          }
        }
      } catch (e) {
        toast({ variant: "destructive", title: "ত্রুটি", description: "শীট লোড করা সম্ভব হয়নি।" });
      } finally { setLoading(false); }
    }
    if (user && db) loadSheet();
  }, [editId, db, user, toast]);

  useEffect(() => {
    if (activeEditIdx !== null && pageStyles[activeEditIdx]) {
      setFontSizeDraft(String(pageStyles[activeEditIdx].fontSize));
      setLineHeightDraft(String(pageStyles[activeEditIdx].lineHeight));
    } else { 
      setFontSizeDraft(String(globalFontSize)); 
      setLineHeightDraft(String(globalLineHeight)); 
    }
  }, [activeEditIdx, globalFontSize, globalLineHeight, pageStyles]);

  const mT = printSettings.marginTop;
  const mB = printSettings.marginBottom;
  const mL = printSettings.marginLeft;
  const mR = printSettings.marginRight;

  useEffect(() => {
    if (!isPrintMode || !data.content || !measurementRef.current) return;
    
    if (Object.keys(manualPages).length > 0) {
      const sortedIndices = Object.keys(manualPages).map(Number).sort((a, b) => a - b);
      setPaginatedPages(sortedIndices.map(idx => manualPages[idx]));
      return;
    }

    const container = measurementRef.current;
    const contentHtml = formatMath(data.content);
    const marginT = parseFloat(String(mT)) || 0.5, marginL = parseFloat(String(mL)) || 0.5, marginR = parseFloat(String(mR)) || 0.5;
    
    container.style.width = (8.27 - marginL - marginR) + 'in';
    container.style.fontSize = globalFontSize + 'pt';
    container.style.lineHeight = String(globalLineHeight);
    
    // Split content by block tags or newlines
    let tempBlocks: string[] = [];
    if (/<(p|div|h[1-6]|table|blockquote|li)[^>]*>/i.test(contentHtml)) {
      const parserDiv = document.createElement('div');
      parserDiv.innerHTML = contentHtml;
      Array.from(parserDiv.childNodes).forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          tempBlocks.push((node as HTMLElement).outerHTML);
        } else if (node.textContent && node.textContent.trim()) {
          tempBlocks.push(`<p>${node.textContent}</p>`);
        }
      });
    }
    if (tempBlocks.length === 0) {
      tempBlocks = contentHtml.split('\n').filter(l => l.trim() !== '');
    }
    container.innerHTML = tempBlocks.map(block => `<div class="measure-line" style="min-height: 1.2em;">${block}</div>`).join('');
    
    const headerSpace = 135, footerSpace = 65, topicSpacePx = 65, totalPageHeightPx = 11.69 * 96;
    const availableHeightPx = totalPageHeightPx - (marginT * 96) - (parseFloat(String(mB)) * 96) - headerSpace - footerSpace;
    
    const newPages: string[] = [];
    let currentChunk = "", currentHeight = 0;
    const lines = container.querySelectorAll('.measure-line');
    
    lines.forEach((line) => {
      const h = (line as HTMLElement).offsetHeight || 18;
      const effectiveLimit = (newPages.length === 0) ? (availableHeightPx - topicSpacePx) : availableHeightPx;
      if (currentHeight > 0 && currentHeight + h > effectiveLimit) { 
        if (currentChunk.trim() !== "") newPages.push(currentChunk); 
        currentChunk = line.innerHTML + "<br/>"; 
        currentHeight = h; 
      }
      else { 
        currentChunk += line.innerHTML + "<br/>"; 
        currentHeight += h; 
      }
    });
    if (currentChunk.trim() !== "") newPages.push(currentChunk);
    
    const pagesToRender = newPages.length > 0 ? newPages : [""];
    setPaginatedPages(pagesToRender);
    
    const initialStyles: Record<number, any> = {}, initialManual: Record<number, string> = {};
    pagesToRender.forEach((p, i) => { 
      initialStyles[i] = pageStyles[i] || { fontSize: globalFontSize, lineHeight: globalLineHeight, bold: false, italic: false, underline: false, color: '#000000', align: 'justify', mT: marginT, mB: mB, mL: marginL, mR: marginR, columns: 1, columnRule: false, orientation: 'portrait', border: 'none' }; 
      initialManual[i] = p; 
    });
    setPageStyles(initialStyles); 
    setManualPages(initialManual);

  }, [isPrintMode, data.content, mT, mB, mL, mR, globalFontSize, globalLineHeight]);

  const handleAddNextPage = useCallback((initialContent: string = '') => {
    setPaginatedPages(prev => [...prev, initialContent]);
    setManualPages(prev => {
      const nextIdx = Object.keys(prev).length;
      return { ...prev, [nextIdx]: initialContent };
    });
  }, []);

  const handleRemoveEmptyPage = useCallback((idxToRemove: number) => {
    setPaginatedPages(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idxToRemove);
    });
    setManualPages(prev => {
      const updated: Record<number, string> = {};
      const sortedKeys = Object.keys(prev).map(Number).sort((a, b) => a - b).filter(i => i !== idxToRemove);
      sortedKeys.forEach((oldIdx, newIdx) => {
        updated[newIdx] = prev[oldIdx];
      });
      return updated;
    });
  }, []);

  const handleFocusPage = useCallback((pageIdx: number, position: 'start' | 'end') => {
    setActiveEditIdx(pageIdx);
    const targetEl = document.querySelector(`.paper-idx-${pageIdx} .content-area`) as HTMLElement | null;
    if (targetEl) {
      setCursor(targetEl, position);
    }
  }, []);

  const handleSyncPageContent = useCallback((pageIdx: number, content: string) => {
    setManualPages(prev => ({ ...prev, [pageIdx]: content }));
  }, []);

  const subjects = useMemo(() => data.classId ? getSubjectsForClass(data.classId) : [], [data.classId]);
  const chapters = useMemo(() => (data.classId && data.subject) ? getChaptersForSubject(data.classId, data.subject) : [], [data.classId, data.subject]);

  const updatePageStyle = useCallback((idx: number, key: string, val: any) => { 
    setPageStyles(prev => {
      const current = prev[idx] || { fontSize: globalFontSize, lineHeight: globalLineHeight, bold: false, italic: false, underline: false, color: '#000000', align: 'justify', mT: 0.5, mB: 0.5, mL: 0.5, mR: 0.5, columns: 1, columnRule: false, orientation: 'portrait', border: 'none' };
      return { ...prev, [idx]: { ...current, [key]: val } };
    }); 
  }, [globalFontSize, globalLineHeight]);

  const handleFormatting = useCallback((command: string, value: string | null = null) => {
    const selection = window.getSelection();
    const hasSelection = selection && selection.rangeCount > 0 && !selection.isCollapsed;
    
    if (hasSelection) {
      if (command === 'fontSize') { 
        const val = value + 'pt';
        const span = document.createElement('span'); 
        span.style.fontSize = val; 
        const range = selection.getRangeAt(0); 
        try {
          span.appendChild(range.extractContents()); 
          range.insertNode(span);
          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } catch (e) { document.execCommand('fontSize', false, '3'); }
      }
      else document.execCommand(command, false, value || '');
    } else if (activeEditIdx !== null) {
      const numVal = parseFloat(value || '0');
      if (command === 'fontSize' && !isNaN(numVal)) updatePageStyle(activeEditIdx, 'fontSize', numVal);
      else if (command === 'lineHeight' && !isNaN(numVal)) updatePageStyle(activeEditIdx, 'lineHeight', numVal);
      else if (command === 'bold') updatePageStyle(activeEditIdx, 'bold', !pageStyles[activeEditIdx]?.bold);
      else if (command === 'italic') updatePageStyle(activeEditIdx, 'italic', !pageStyles[activeEditIdx]?.italic);
      else if (command === 'underline') updatePageStyle(activeEditIdx, 'underline', !pageStyles[activeEditIdx]?.underline);
      else if (command === 'foreColor') updatePageStyle(activeEditIdx, 'color', value);
      else if (command.startsWith('justify')) { 
        const alignMap: any = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right', justifyFull: 'justify' }; 
        updatePageStyle(activeEditIdx, 'align', alignMap[command]); 
      }
    }
  }, [activeEditIdx, pageStyles, updatePageStyle]);

  const handleSave = useCallback(() => {
    if (!user || !db) return;
    setSaving(true);
    let updatedFullContent = data.content, updatedManualPages = { ...manualPages };
    
    if (isPrintMode) {
      const papers = document.querySelectorAll('.paper');
      const tempManual: Record<number, string> = {};
      papers.forEach(paper => { 
        const match = paper.className.match(/paper-idx-(\d+)/); 
        if (match) { 
           const idx = parseInt(match[1]); 
           const contentArea = paper.querySelector('.content-area'); 
           if (contentArea) tempManual[idx] = contentArea.innerHTML || ""; 
        } 
      });
      updatedManualPages = tempManual;
      const sortedIndices = Object.keys(tempManual).map(Number).sort((a, b) => a - b);
      updatedFullContent = sortedIndices.map(idx => tempManual[idx]).join('\n\n');
    }

    const docId = editId || doc(collection(db, 'lecture-sheets')).id;
    const ref = doc(db, 'lecture-sheets', docId);
    
    const payload: any = { 
      ...data, 
      content: updatedFullContent, 
      printSettings, 
      pageStyles, 
      manualPages: updatedManualPages, 
      updatedAt: serverTimestamp() 
    };
    if (!editId) {
      payload.userId = user.uid;
      payload.createdAt = serverTimestamp();
    }
    
    setDoc(ref, payload, { merge: true }).then(() => { 
      setSaving(false); 
      setManualPages(updatedManualPages); 
      setData(prev => ({ ...prev, content: updatedFullContent })); 
      toast({ title: "সফল!", description: "শিটটি সংরক্ষিত হয়েছে।" }); 
      if (!editId) router.replace(`/create-lecture-sheet?id=${docId}`); 
    })
    .catch(async (error) => { 
      setSaving(false); 
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'write', requestResourceData: payload })); 
    });
  }, [user, db, editId, data, printSettings, pageStyles, manualPages, router, toast, isPrintMode]);

  const handleFileUpload = async () => {
    if (!db || !user || !uploadFile || !data.classId || !data.subject || !data.type) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "শ্রেণি, বিষয় ও ফাইল নিশ্চিত করুন।" });
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      const base64String = await fileToBase64(uploadFile);
      setUploadProgress(60);

      const sheetData = {
        category: data.type === 'lecture_sheet' ? 'lecture_sheet' : (data.type === 'creative' ? 'creative' : (data.type === 'mcq' ? 'mcq' : (data.type === 'model_test' ? 'model_test' : 'answer_key'))),
        classId: data.classId,
        subject: data.subject,
        chapterName: data.topic || 'সাধারণ',
        fileName: uploadFile.name,
        pdfUrl: base64String, 
        uploadedAt: serverTimestamp(),
        userId: user.uid
      };

      await addDoc(collection(db, 'pdf-sheets'), sheetData);
      setUploadProgress(100);
      toast({ title: "সফল", description: "ফাইলটি সফলভাবে সংরক্ষিত হয়েছে।" });
      setUploading(false);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      toast({ variant: "destructive", title: "ত্রুটি", description: e.message });
      setUploading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      if ((e.ctrlKey || e.metaKey)) { 
        const key = e.key.toLowerCase();
        if (['s', 'n', 'd', 'l', 'e', 'r', '[', ']', 'x', 'z', 'y', 'b', 'i', 'u', 'c', 'v', 'a'].includes(key)) {
          if (['x', 'c', 'v', 'a', 'z', 'y'].includes(key)) return; 
          e.preventDefault();
          if (key === 's') handleSave();
          else if (key === 'n') setPaginatedPages(prev => [...prev, ""]);
          else if (key === 'b') handleFormatting('bold');
          else if (key === 'i') handleFormatting('italic');
          else if (key === 'u' || key === 'd') handleFormatting('underline');
          else if (key === 'l') handleFormatting('justifyLeft');
          else if (key === 'e') handleFormatting('justifyCenter');
          else if (key === 'r') handleFormatting('justifyRight');
          else if (key === '[') { 
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
              const parent = selection.anchorNode?.parentElement;
              let currentSize = 10.5;
              if (parent) { 
                const style = window.getComputedStyle(parent);
                const fs = parseFloat(style.fontSize);
                currentSize = (fs * 0.75) || 10.5;
              }
              const nextVal = Math.max(1, currentSize - 0.5);
              handleFormatting('fontSize', nextVal.toString());
            } else if (activeEditIdx !== null) {
              const currentSize = pageStyles[activeEditIdx]?.fontSize || globalFontSize || 10.5;
              const nextVal = Math.max(1, currentSize - 0.5);
              updatePageStyle(activeEditIdx, 'fontSize', nextVal);
              setFontSizeDraft(nextVal.toString());
            }
          }
          else if (key === ']') { 
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
              const parent = selection.anchorNode?.parentElement;
              let currentSize = 10.5;
              if (parent) { 
                const style = window.getComputedStyle(parent);
                const fs = parseFloat(style.fontSize);
                currentSize = (fs * 0.75) || 10.5;
              }
              const nextVal = Math.min(100, currentSize + 0.5);
              handleFormatting('fontSize', nextVal.toString());
            } else if (activeEditIdx !== null) {
              const currentSize = pageStyles[activeEditIdx]?.fontSize || globalFontSize || 10.5;
              const nextVal = Math.min(100, currentSize + 0.5);
              updatePageStyle(activeEditIdx, 'fontSize', nextVal);
              setFontSizeDraft(nextVal.toString());
            }
          }
        }
      } 
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleFormatting, activeEditIdx, pageStyles, globalFontSize, updatePageStyle]);

  const compressImageForOcr = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSide = 1800;
          let width = img.width;
          let height = img.height;
          if (width > maxSide || height > maxSide) {
            if (width > height) {
              height = Math.round((height * maxSide) / width);
              width = maxSide;
            } else {
              width = Math.round((width * maxSide) / height);
              height = maxSide;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target?.result as string);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'ফাইলটি অনেক বড়',
        description: 'দয়া করে ২০ মেগাবাইট বা তার ছোট ফাইল আপলোড করুন।',
      });
      return;
    }

    setIsScanning(true);
    toast({
      title: 'AI স্ক্যান শুরু হয়েছে...',
      description: `${file.name} — টেক্সট উদ্ধার করা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন।`,
    });

    try {
      let fileDataUri = '';
      const mimeType = file.type || 'image/jpeg';

      if (file.type === 'application/pdf') {
        fileDataUri = await fileToBase64(file);
      } else {
        fileDataUri = await compressImageForOcr(file);
      }

      const result = await performAiOcr({ fileDataUri, mimeType });
      if (result?.text) {
        setData((prev) => ({
          ...prev,
          content: prev.content ? prev.content + '\n\n' + result.text : result.text,
        }));
        toast({
          title: 'AI স্ক্যান সম্পন্ন! 🎉',
          description: 'সফলভাবে টেক্সট উদ্ধার করে শিটে যুক্ত করা হয়েছে।',
        });
      } else {
        throw new Error('কোনো টেক্সট পাওয়া যায়নি।');
      }
    } catch (error: any) {
      console.error('OCR Error:', error);
      toast({
        variant: 'destructive',
        title: 'স্ক্যান ব্যর্থ হয়েছে',
        description: error?.message || 'পুনরায় চেষ্টা করুন।',
      });
    } finally {
      setIsScanning(false);
      if (ocrInputRef.current) ocrInputRef.current.value = '';
    }
  };

  const handleWatermarkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const base64 = await processWatermarkImage(file); setPrintSettings((prev: any) => ({...prev, watermarkImageUrl: base64})); toast({title: "সফল", description: "লোগো আপলোড হয়েছে।"}); }
    catch (err) { toast({variant: "destructive", title: "ত্রুটি", description: "লোগো প্রসেস করা সম্ভব হয়নি।"}); }
  };

  const handleGlobalFontSizeChange = (size: string) => { const val = parseFloat(size); if (!isNaN(val)) { setGlobalFontSize(val); setPageStyles((prev: any) => { const updated: any = { ...prev }; Object.keys(updated).forEach(idx => { updated[parseInt(idx)] = { ...updated[parseInt(idx)], fontSize: val }; }); return updated; }); } };
  const handleGlobalLineHeightChange = (val: string) => { const num = parseFloat(val); if (!isNaN(num)) { setGlobalLineHeight(num); setPageStyles((prev: any) => { const updated: any = { ...prev }; Object.keys(updated).forEach(idx => { updated[parseInt(idx)] = { ...updated[parseInt(idx)], lineHeight: num }; }); return updated; }); } };

  if (loading || userLoading) return <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]"><Loader2 className="w-12 h-12 animate-spin text-primary mb-4" /><p className="font-bold">অ্যাক্সেস চেক করা হচ্ছে...</p></div>;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-16 font-kalpurush">
      <div ref={measurementRef} className="fixed invisible pointer-none whitespace-pre-wrap text-[10.5pt] font-kalpurush" style={{ width: '7.27in', lineHeight: '1.2' }} />
      <div className={cn("no-print space-y-8", isPrintMode && "hidden")}>
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-sm"><BookOpen className="w-7 h-7" /></div>
            <h2 className="text-2xl font-bold text-primary">লেকচার শিট নির্মাতা</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold"><ArrowLeft className="w-4 h-4" /> ফিরে যান</Button>
            <Button variant="secondary" onClick={() => window.print()} className="gap-2 font-bold"><Printer className="w-4 h-4" /> প্রিন্ট</Button>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <aside className="w-full lg:w-80 shrink-0 space-y-6 sticky top-24">
            <Card className="shadow-md border-primary/10">
              <CardHeader className="bg-primary/5 border-b py-3">
                <CardTitle className="text-base flex items-center gap-2 font-bold text-primary"><FileText className="w-4 h-4" /> শিট সংক্রান্ত তথ্য</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <Button
                  type="button"
                  onClick={() => setAiModalOpen(true)}
                  className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-800 text-white font-black text-xs h-10 shadow-md"
                >
                  <BrainCircuit className="w-4 h-4 mr-2 text-amber-300 animate-pulse" /> AI দিয়ে লেকচার শিট তৈরি করুন
                </Button>

                {/* AI Lecture Sheet Dialog */}
                <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
                  <DialogContent className="font-kalpurush max-w-md bg-white border-2 border-emerald-200">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-black flex items-center gap-2 text-emerald-950">
                        <BrainCircuit className="h-5 w-5 text-emerald-600" /> AI লেকচার শিট জেনারেটর
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <p className="text-xs text-slate-600 font-bold">
                        সার্ভারের নির্ধারিত বিষয় ও অধ্যায় সিলেক্ট করে এক ক্লিকে সম্পূর্ণ শিট তৈরি করুন।
                      </p>

                      {/* 1. Sheet Type Dropdown */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">শিটের ধরণ</label>
                        <Select value={aiSheetType} onValueChange={(v: any) => setAiSheetType(v)}>
                          <SelectTrigger className="h-9 font-black text-xs bg-slate-50 border-emerald-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lecture_sheet" className="font-bold text-xs">📖 লেকচার শিট (হ্যান্ডআউট)</SelectItem>
                            <SelectItem value="creative" className="font-bold text-xs">📝 সৃজনশীল প্রশ্নপত্র</SelectItem>
                            <SelectItem value="model_test" className="font-bold text-xs">🏆 মডেল টেস্ট প্রশ্নপত্র</SelectItem>
                            <SelectItem value="mcq" className="font-bold text-xs">🔘 বহুনির্বাচনী প্রশ্ন (MCQ)</SelectItem>
                            <SelectItem value="answer_key" className="font-bold text-xs">✅ উত্তরমালা ও সমাধান</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 2. Class Dropdown */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">শ্রেণি</label>
                        <Select 
                          value={aiClassId} 
                          onValueChange={(v) => {
                            setAiClassId(v);
                            const availableSubs = getSubjectsForClass(v);
                            if (availableSubs.length > 0) {
                              setAiSubject(availableSubs[0]);
                              const chaps = getChaptersForSubject(v, availableSubs[0]);
                              if (chaps.length > 0) setAiChapter(chaps[0]);
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 font-bold text-xs">
                            <SelectValue placeholder="শ্রেণি নির্বাচন করুন" />
                          </SelectTrigger>
                          <SelectContent>
                            {CLASSES.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="font-bold text-xs">
                                {c.label} শ্রেণি
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 3. Subject Dropdown */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">বিষয়</label>
                        <Select 
                          value={aiSubject} 
                          onValueChange={(v) => {
                            setAiSubject(v);
                            const chaps = getChaptersForSubject(aiClassId, v);
                            if (chaps.length > 0) setAiChapter(chaps[0]);
                          }}
                        >
                          <SelectTrigger className="h-9 font-bold text-xs">
                            <SelectValue placeholder="বিষয় নির্বাচন করুন" />
                          </SelectTrigger>
                          <SelectContent>
                            {getSubjectsForClass(aiClassId).map((s) => (
                              <SelectItem key={s} value={s} className="font-bold text-xs">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 4. Chapter Dropdown from Server Constants */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">অধ্যায় নির্বাচন *</label>
                        {getChaptersForSubject(aiClassId, aiSubject).length > 0 ? (
                          <Select value={aiChapter} onValueChange={setAiChapter}>
                            <SelectTrigger className="h-9 font-black text-xs border-emerald-400 bg-emerald-50/50">
                              <SelectValue placeholder="অধ্যায় বেছে নিন" />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {getChaptersForSubject(aiClassId, aiSubject).map((ch) => (
                                <SelectItem key={ch} value={ch} className="font-bold text-xs">
                                  {ch}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder="যেমন: ১ম অধ্যায়, ২য় অধ্যায়..."
                            value={aiChapter}
                            onChange={(e) => setAiChapter(e.target.value)}
                            className="h-9 text-xs font-bold border-emerald-300"
                          />
                        )}
                      </div>

                      {/* 5. Specific Topic / Subtopic (Optional) */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">নির্দিষ্ট টপিক বা ফোকাস (ঐচ্ছিক)</label>
                        <Input
                          placeholder="যেমন: নিউটনের ৩য় সূত্র ও ভরবেগের নিত্যতা..."
                          value={aiCustomTopic}
                          onChange={(e) => setAiCustomTopic(e.target.value)}
                          className="h-9 text-xs font-bold"
                        />
                      </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button variant="outline" size="sm" onClick={() => setAiModalOpen(false)}>
                        বাতিল
                      </Button>
                      <Button
                        onClick={handleGenerateAiSheet}
                        disabled={aiGenerating || !aiClassId || !aiSubject || !aiChapter.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs"
                      >
                        {aiGenerating ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> তৈরি হচ্ছে...
                          </>
                        ) : (
                          'তৈরি করুন'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">শিটের ধরণ</label>
                  <Select onValueChange={v => setData(prev => ({...prev, type: v}))} value={data.type}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="ধরণ নির্বাচন" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lecture_sheet">লেকচার শিট</SelectItem>
                      <SelectItem value="creative">সৃজনশীল প্রশ্ন</SelectItem>
                      <SelectItem value="mcq">বহুনির্বাচনী প্রশ্ন</SelectItem>
                      <SelectItem value="model_test">মডেল টেস্ট</SelectItem>
                      <SelectItem value="answer_key">উত্তরমালা</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">প্রতিষ্ঠানের নাম</label>
                  <Input value={data.institution || ''} onChange={e => setData(prev => ({...prev, institution: e.target.value}))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">শ্রেণি</label>
                  <Select onValueChange={v => setData(prev => ({...prev, classId: v}))} value={data.classId}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                    <SelectContent>
                      {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">বিষয়</label>
                  <Select onValueChange={v => setData(prev => ({...prev, subject: v}))} value={data.subject} disabled={!data.classId}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="বিষয়" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">টপিক / শিরোনাম</label>
                  {chapters.length > 0 ? (
                    <Select onValueChange={v => setData(prev => ({...prev, topic: v}))} value={data.topic}>
                      <SelectTrigger className="font-bold"><SelectValue placeholder="অধ্যায় নির্বাচন করুন" /></SelectTrigger>
                      <SelectContent>
                        {chapters.map(ch => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={data.topic || ''} onChange={e => setData(prev => ({...prev, topic: e.target.value}))} placeholder="যেমন: ৩য় অধ্যায়" />
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button onClick={handleSave} disabled={saving || activeCreationMode === 'pdf'} className="w-full gap-2 font-bold h-11"><Save className="w-4 h-4" /> সেভ করুন (Ctrl+S)</Button>
              <Button onClick={() => { if(!data.content) return; const p = new URLSearchParams(window.location.search); p.set('print', 'true'); if(editId) p.set('id', editId); router.push(`${window.location.pathname}?${p.toString()}`); }} variant="outline" className="w-full gap-2 border-primary text-primary font-bold h-11" disabled={activeCreationMode === 'pdf'}><Eye className="w-4 h-4" /> প্রিন্ট প্রিভিউ</Button>
            </div>
          </aside>

          <div className="flex-1 w-full space-y-6">
            <Tabs value={activeCreationMode} onValueChange={(v: any) => setActiveCreationMode(v)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-secondary/50 p-1 h-12">
                <TabsTrigger value="text" className="gap-2 font-bold h-10"><Edit3 className="w-4 h-4" /> এডিটর ব্যবহার করুন</TabsTrigger>
                <TabsTrigger value="pdf" className="gap-2 font-bold h-10"><FileType className="w-4 h-4" /> ফাইল আপলোড (PDF/Word)</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="animate-in fade-in duration-300">
                <Card className="shadow-md border-2 border-indigo-100 overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b p-3 px-5 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span className="text-sm font-black text-slate-800">কন্টেন্ট এডিটর (প্রিন্ট লেআউট ভিউ)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* View Mode Toggle: Visual vs Code */}
                      <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setEditorViewMode('visual')}
                          className={cn(
                            'px-2.5 py-1 rounded-md transition-all',
                            editorViewMode === 'visual' ? 'bg-white shadow-sm text-indigo-700 font-black' : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          ভিজ্যুয়াল ফরম্যাট
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorViewMode('code')}
                          className={cn(
                            'px-2.5 py-1 rounded-md transition-all',
                            editorViewMode === 'code' ? 'bg-white shadow-sm text-indigo-700 font-black' : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          সোর্স কোড (HTML)
                        </button>
                      </div>

                      <input type="file" ref={ocrInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleOCR} />
                      <Button onClick={() => ocrInputRef.current?.click()} disabled={isScanning} variant="outline" size="sm" className="h-8 gap-1.5 border-indigo-600 text-indigo-700 font-bold">
                        {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />} এআই স্ক্যান
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-6 bg-slate-100/50 min-h-[650px]">
                    {editorViewMode === 'visual' ? (
                      /* 1. Live Visual Print-Style Layout Editor */
                      <div className="bg-white rounded-xl border-2 border-slate-200 shadow-lg p-6 sm:p-10 font-kalpurush min-h-[600px] text-slate-900 leading-relaxed">
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newHtml = e.currentTarget.innerHTML;
                            setData((prev) => ({ ...prev, content: newHtml }));
                          }}
                          className="outline-none focus:ring-2 focus:ring-indigo-300 rounded-lg p-2 min-h-[550px] space-y-3 prose max-w-none text-base"
                          dangerouslySetInnerHTML={{
                            __html: formatMath(data.content || '')
                          }}
                        />
                      </div>
                    ) : (
                      /* 2. Raw HTML / Source Code Editor */
                      <div className="bg-slate-900 rounded-xl p-4 shadow-inner">
                        <Textarea 
                          placeholder="HTML বা টেক্সট লিখুন..." 
                          value={data.content || ''} 
                          onChange={e => setData(prev => ({ ...prev, content: e.target.value }))} 
                          className="min-h-[580px] font-mono text-sm leading-relaxed text-emerald-400 bg-transparent border-none focus-visible:ring-0 shadow-none p-0 resize-y" 
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pdf" className="animate-in fade-in duration-300">
                <Card className="shadow-md border-indigo-100 border-2">
                  <CardHeader className="bg-indigo-50/50 border-b">
                    <CardTitle className="text-lg flex items-center gap-2 font-bold text-indigo-700">
                      <FileUp className="w-6 h-6" /> সরাসরি ফাইল আপলোড (PDF/Word)
                    </CardTitle>
                    <CardDescription className="font-bold">আপনার তৈরিকৃত পিডিএফ বা ওয়ার্ড ফাইলটি এখানে সিলেক্ট করে সরাসরি আপলোড করুন।</CardDescription>
                  </CardHeader>
                  <CardContent className="py-10 flex flex-col items-center justify-center space-y-6">
                    <div 
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      className="w-full max-w-md border-2 border-dashed border-indigo-300 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 bg-indigo-50/20 hover:bg-indigo-50/40 transition-all cursor-pointer group"
                    >
                      <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <FileType className="w-10 h-10" />
                      </div>
                      <div className="text-center">
                        <p className="font-black text-indigo-800 text-lg">{uploadFile ? uploadFile.name : 'ফাইল নির্বাচন করুন'}</p>
                        <p className="text-xs text-muted-foreground font-bold mt-1">ফাইল সাইজ ১ এমবি এর কম হওয়া বাঞ্ছনীয়</p>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                    </div>

                    {uploading && (
                      <div className="w-full max-w-md space-y-2">
                        <div className="flex justify-between text-xs font-black text-indigo-600">
                          <span>প্রসেসিং ও আপলোড হচ্ছে...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                      </div>
                    )}

                    <Button 
                      onClick={handleFileUpload} 
                      disabled={uploading || !uploadFile || !data.classId || !data.subject} 
                      className="w-full max-w-md h-12 text-lg font-black bg-indigo-600 hover:bg-indigo-700 shadow-lg gap-2"
                    >
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      ফাইল আপলোড ও সেভ করুন
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {isPrintMode && (
        <div className="print-view-container flex flex-col h-screen fixed inset-0 top-0 left-0 bg-slate-100 z-[40] font-kalpurush overflow-hidden">
          <header className="no-print h-14 bg-white border-b flex items-center justify-between px-6 shrink-0 shadow-sm z-50 select-none">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center"><Eye className="w-5 h-5" /></div>
               <h3 className="font-bold text-lg">প্রিন্ট প্রিভিউ ও লেআউট - {data.institution || softwareConfig?.appName || 'টপ গ্রেড'}</h3>
             </div>
             <div className="flex gap-3">
               <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-2 font-bold border-primary text-primary bg-white"><ArrowLeft className="w-4 h-4" /> ফিরে যান</Button>
               <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2 font-bold bg-green-600 hover:bg-green-700 px-4">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} সেভ (Ctrl+S)</Button>
               <Button size="sm" onClick={() => window.print()} className="gap-2 font-bold bg-primary px-6"><Printer className="w-4 h-4" /> প্রিন্ট করুন</Button>
             </div>
          </header>

          {/* Microsoft Word Ribbon Toolbar */}
          <WordToolbar
            onAddPage={() => setPaginatedPages(prev => [...prev, ""])}
            onDeletePage={() => {
              if (activeEditIdx === null) {
                if (paginatedPages.length <= 1) return;
                const newP = paginatedPages.slice(0, -1);
                setPaginatedPages(newP);
                return;
              }
              if (!confirm(`পাতা ${activeEditIdx + 1} মুছে ফেলবেন?`)) return;
              const newP = paginatedPages.filter((_, i) => i !== activeEditIdx);
              setPaginatedPages(newP);
              setActiveEditIdx(null);
            }}
            activePageIndex={activeEditIdx}
            totalPages={paginatedPages.length}
            zoomLevel={previewZoom}
            onZoomChange={setPreviewZoom}
            currentColumns={pageStyles[activeEditIdx !== null ? activeEditIdx : 0]?.columns || 1}
            currentColumnRule={pageStyles[activeEditIdx !== null ? activeEditIdx : 0]?.columnRule || false}
            onColumnsChange={(cols, hasRule) => {
              if (activeEditIdx !== null) {
                updatePageStyle(activeEditIdx, 'columns', cols);
                updatePageStyle(activeEditIdx, 'columnRule', !!hasRule);
              } else {
                paginatedPages.forEach((_, i) => {
                  updatePageStyle(i, 'columns', cols);
                  updatePageStyle(i, 'columnRule', !!hasRule);
                });
              }
            }}
            currentOrientation={pageStyles[activeEditIdx !== null ? activeEditIdx : 0]?.orientation || 'portrait'}
            onOrientationChange={(orient) => {
              if (activeEditIdx !== null) {
                updatePageStyle(activeEditIdx, 'orientation', orient);
              } else {
                paginatedPages.forEach((_, i) => {
                  updatePageStyle(i, 'orientation', orient);
                });
              }
            }}
            onMarginPresetChange={(preset) => {
              const mVal = preset === 'narrow' ? 0.25 : preset === 'wide' ? 1.0 : 0.5;
              if (activeEditIdx !== null) {
                updatePageStyle(activeEditIdx, 'mT', mVal);
                updatePageStyle(activeEditIdx, 'mB', mVal);
                updatePageStyle(activeEditIdx, 'mL', mVal);
                updatePageStyle(activeEditIdx, 'mR', mVal);
              } else {
                setPrintSettings((p: any) => ({ ...p, marginTop: mVal, marginBottom: mVal, marginLeft: mVal, marginRight: mVal }));
                paginatedPages.forEach((_, i) => {
                  updatePageStyle(i, 'mT', mVal);
                  updatePageStyle(i, 'mB', mVal);
                  updatePageStyle(i, 'mL', mVal);
                  updatePageStyle(i, 'mR', mVal);
                });
              }
            }}
            currentPageBorder={pageStyles[activeEditIdx !== null ? activeEditIdx : 0]?.border || 'none'}
            onPageBorderChange={(border) => {
              if (activeEditIdx !== null) {
                updatePageStyle(activeEditIdx, 'border', border);
              } else {
                paginatedPages.forEach((_, i) => {
                  updatePageStyle(i, 'border', border);
                });
              }
            }}
          />
          <div className="flex-1 flex overflow-hidden">
            <aside className="no-print w-80 bg-white border-r overflow-y-auto p-6 space-y-8 shrink-0 pb-16 custom-scrollbar">
               {activeEditIdx !== null && pageStyles[activeEditIdx] ? (
                 <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    <div className="flex items-center justify-between"><h4 className="text-xs font-black text-blue-600 uppercase flex items-center gap-2"><Edit3 className="w-3.5 h-3.5" /> পাতা {toBengaliNumber(activeEditIdx + 1)} টুলস</h4><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActiveEditIdx(null)}><X className="w-3 h-3" /></Button></div>
                    <div className="p-4 rounded-xl border-2 border-blue-100 bg-blue-50/30 space-y-6">
                      <div className="space-y-4"><label className="text-[10px] font-black text-slate-500 uppercase">পেজ মার্জিন (ইঞ্চি)</label><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><label className="text-[9px] font-bold">উপরে</label><Input type="text" value={pageStyles[activeEditIdx].mT} onChange={e => { const v = e.target.value; if(v==='' || /^\d*\.?\d*$/.test(v)) updatePageStyle(activeEditIdx!, 'mT', v); }} className="h-7 text-xs font-bold no-arrows" /></div><div className="space-y-1"><label className="text-[9px] font-bold">নিচে</label><Input type="text" value={pageStyles[activeEditIdx].mB} onChange={e => { const v = e.target.value; if(v==='' || /^\d*\.?\d*$/.test(v)) updatePageStyle(activeEditIdx!, 'mB', v); }} className="h-7 text-xs font-bold no-arrows" /></div><div className="space-y-1"><label className="text-[9px] font-bold">বামে</label><Input type="text" value={pageStyles[activeEditIdx].mL} onChange={e => { const v = e.target.value; if(v==='' || /^\d*\.?\d*$/.test(v)) updatePageStyle(activeEditIdx!, 'mL', v); }} className="h-7 text-xs font-bold no-arrows" /></div><div className="space-y-1"><label className="text-[9px] font-bold">ডানে</label><Input type="text" value={pageStyles[activeEditIdx].mR} onChange={e => { const v = e.target.value; if(v==='' || /^\d*\.?\d*$/.test(v)) updatePageStyle(activeEditIdx!, 'mR', v); }} className="h-7 text-xs font-bold no-arrows" /></div></div></div>
                      <Separator className="bg-blue-100" />
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 flex justify-between">ফন্ট সাইজ (pt) <span>{toBengaliNumber(pageStyles[activeEditIdx].fontSize)}pt</span></label>
                        <Input type="text" value={fontSizeDraft} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) { setFontSizeDraft(val); handleFormatting('fontSize', val); } }} className="h-8 text-xs font-bold no-arrows mb-2" />
                        <Slider value={[pageStyles[activeEditIdx].fontSize]} min={1} max={100} step={0.5} onValueChange={([v]) => { handleFormatting('fontSize', v.toString()); setFontSizeDraft(v.toString()); }} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 flex justify-between">লাইন স্পেসিং <span>{toBengaliNumber(pageStyles[activeEditIdx].lineHeight)}</span></label>
                        <Input type="text" value={lineHeightDraft} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) { setLineHeightDraft(val); handleFormatting('lineHeight', val); } }} className="h-8 text-xs font-bold no-arrows mb-2" />
                        <Slider value={[pageStyles[activeEditIdx].lineHeight]} min={0.5} max={5.0} step={0.1} onValueChange={([v]) => { handleFormatting('lineHeight', v.toString()); setLineHeightDraft(v.toString()); }} />
                      </div>
                      <div className="flex items-center justify-between"><label className="text-[10px] font-bold text-slate-500 uppercase">টেক্সট স্টাইল</label><div className="flex gap-2"><Button variant={pageStyles[activeEditIdx].bold ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handleFormatting('bold')}><Bold className="w-4 h-4" /></Button><Button variant={pageStyles[activeEditIdx].italic ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handleFormatting('italic')}><Italic className="w-4 h-4" /></Button><Button variant={pageStyles[activeEditIdx].underline ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handleFormatting('underline')}><Underline className="w-4 h-4" /></Button></div></div>
                      <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase">রং (Color)</label><div className="flex items-center gap-3"><input type="color" value={pageStyles[activeEditIdx].color} onChange={(e) => handleFormatting('foreColor', e.target.value)} className="w-10 h-8 rounded border-0 cursor-pointer p-0" /><span className="text-[10px] font-mono font-bold uppercase">{pageStyles[activeEditIdx].color}</span></div></div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-8 animate-in fade-in duration-500">
                   <div className="space-y-4"><h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><Type className="w-3.5 h-3.5" /> গ্লোবাল ফন্ট সাইজ</h4><div className="p-4 rounded-xl border-2 border-slate-100 bg-slate-50/30 space-y-3"><div className="flex justify-between items-center"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ফন্ট সাইজ (pt)</label><span className="text-xs font-black text-primary">{toBengaliNumber(globalFontSize)}pt</span></div><Input type="text" value={fontSizeDraft} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) { setFontSizeDraft(val); handleGlobalFontSizeChange(val); } }} className="h-8 text-xs font-bold no-arrows mb-2" /><Slider value={[globalFontSize]} min={1} max={100} step={0.5} onValueChange={([v]) => { handleGlobalFontSizeChange(v.toString()); setFontSizeDraft(v.toString()); }} /></div></div>
                   <div className="space-y-4"><h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><Rows3 className="w-3.5 h-3.5" /> গ্লোবাল লাইন স্পেসিং</h4><div className="p-4 rounded-xl border-2 border-slate-100 bg-slate-50/30 space-y-3"><div className="flex justify-between items-center"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">লাইন স্পেসিং</label><span className="text-xs font-black text-primary">{toBengaliNumber(globalLineHeight)}</span></div><Input type="text" value={lineHeightDraft} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) { setLineHeightDraft(val); handleGlobalLineHeightChange(val); } }} className="h-8 text-xs font-bold no-arrows mb-2" /><Slider value={[globalLineHeight]} min={0.5} max={5.0} step={0.1} onValueChange={([v]) => { handleGlobalLineHeightChange(v.toString()); setLineHeightDraft(v.toString()); }} /></div></div>
                   <Separator /><div className="space-y-4"><h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><Settings2 className="w-3.5 h-3.5" /> গ্লোবাল মার্জিন</h4><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold">উপরে</label><Input type="text" value={printSettings.marginTop} onChange={e => { const v = e.target.value; if(v==='' || /^\d*\.?\d*$/.test(v)) setPrintSettings((p: any) => ({...p, marginTop: v})); }} className="h-8 font-bold no-arrows" /></div><div className="space-y-1"><label className="text-[10px] font-bold">নিচে</label><Input type="text" value={printSettings.marginBottom} onChange={e => { const v = e.target.value; if(v==='' || /^\d*\.?\d*$/.test(v)) setPrintSettings((p: any) => ({...p, marginBottom: v})); }} className="h-8 font-bold no-arrows" /></div><div className="space-y-1"><label className="text-[10px] font-bold">বামে</label><Input type="text" value={printSettings.marginLeft} onChange={e => { const v = e.target.value; if(v==='' || /^\d*\.?\d*$/.test(v)) setPrintSettings((p: any) => ({...p, marginLeft: v})); }} className="h-8 font-bold no-arrows" /></div><div className="space-y-1"><label className="text-[10px] font-bold">ডানে</label><Input type="text" value={printSettings.marginRight} onChange={e => { const v = e.target.value; if(v==='' || /^\d*\.?\d*$/.test(v)) setPrintSettings((p: any) => ({...p, marginRight: v})); }} className="h-8 font-bold no-arrows" /></div></div></div>
                 </div>
               )}

               <Separator className="my-6" />
               <div className="space-y-4">
                 <h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><SlidersHorizontal className="w-3.5 h-3.5" /> জলছাপ সেটিংস</h4>
                 <div className="p-4 rounded-xl border-2 border-slate-100 bg-slate-50/30 space-y-4">
                   <div className="flex gap-2">
                     <Button variant={printSettings.watermarkType === 'text' ? 'default' : 'outline'} className="flex-1 h-8 text-[10px] font-bold gap-1" onClick={() => setPrintSettings((p: any) => ({...p, watermarkType: 'text'}))}><Type className="w-3 h-3" /> টেক্সট</Button>
                     <Button variant={printSettings.watermarkType === 'image' ? 'default' : 'outline'} className="flex-1 h-8 text-[10px] font-bold gap-1" onClick={() => setPrintSettings((p: any) => ({...p, watermarkType: 'image'}))}><ImageIcon className="w-3 h-3" /> লোগো</Button>
                   </div>
                   
                   {printSettings.watermarkType === 'text' ? (
                     <div className="space-y-1">
                       <label className="text-[10px] font-bold">জলছাপ টেক্সট</label>
                       <Input value={printSettings.watermarkText || ''} onChange={e => setPrintSettings((p: any) => ({...p, watermarkText: e.target.value}))} placeholder="প্রতিষ্ঠানের নাম" className="h-8 text-xs font-bold" />
                     </div>
                   ) : (
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold">লোগো আপলোড</label>
                       <input type="file" ref={watermarkInputRef} className="hidden" accept="image/*" onChange={handleWatermarkUpload} />
                       <Button variant="outline" size="sm" className="w-full h-8 gap-2 border-primary text-primary font-bold text-[10px]" onClick={() => watermarkInputRef.current?.click()}>
                         <Camera className="w-3 h-3" /> ছবি নির্বাচন করুন
                       </Button>
                       {printSettings.watermarkImageUrl && <div className="mt-2 h-10 w-full bg-white rounded border flex items-center justify-center p-1"><img src={printSettings.watermarkImageUrl} className="max-h-full object-contain" /></div>}
                     </div>
                   )}

                   <div className="space-y-1">
                     <label className="text-[10px] font-bold">জলছাপ এঙ্গেল</label>
                     <Input type="number" value={printSettings.watermarkRotation} onChange={e => setPrintSettings((p: any) => ({...p, watermarkRotation: parseInt(e.target.value) || 0}))} className="h-8 text-xs font-bold" />
                   </div>

                   <div className="space-y-2">
                     <label className="text-[10px] font-bold flex justify-between">জলছাপ সাইজ (%) <span>{toBengaliNumber(printSettings.watermarkImageSize)}%</span></label>
                     <Slider value={[printSettings.watermarkImageSize || 70]} min={10} max={200} step={1} onValueChange={([v]) => setPrintSettings((p: any) => ({...p, watermarkImageSize: v}))} />
                   </div>

                   <div className="space-y-2">
                     <label className="text-[10px] font-bold flex justify-between">জলছাপ ব্রাইটনেস <span>{toBengaliNumber(printSettings.watermarkOpacity)}%</span></label>
                     <Slider value={[printSettings.watermarkOpacity || 10]} min={0} max={100} step={1} onValueChange={([v]) => setPrintSettings((p: any) => ({...p, watermarkOpacity: v}))} />
                   </div>
                 </div>
               </div>
            </aside>
            <main className="print-main-area flex-1 overflow-y-auto bg-slate-200 pt-12 pb-12 flex flex-col items-center gap-10 relative" style={{ zoom: previewZoom !== 100 ? `${previewZoom}%` : undefined }}>
               {paginatedPages.map((pageHtml, idx) => {
                 const style = pageStyles[idx] || { fontSize: globalFontSize, lineHeight: globalLineHeight, bold: false, italic: false, underline: false, color: '#000000', align: 'justify', mT: 0.5, mB: 0.5, mL: 0.5, mR: 0.5 };
                 const marginT = parseFloat(String(style.mT)) || 0.5, marginB = parseFloat(String(style.mB)) || 0.5, marginL = parseFloat(String(style.mL)) || 0.5, marginR = parseFloat(String(style.mR)) || 0.5;
                 const isLandscape = style.orientation === 'landscape';
                 const pWidth = isLandscape ? '11.69in' : '8.27in';
                 const pHeight = isLandscape ? '8.27in' : '11.69in';
                 const borderCss = style.border === 'thin' ? '1.5px solid #000' :
                                   style.border === 'double' ? '3.5px double #000' :
                                   style.border === 'box' ? '2.5px solid #1e293b' : undefined;
                 const cols = style.columns || 1;
                 const hasRule = style.columnRule || false;
                 return (
                 <div key={idx} className={cn(`paper paper-idx-${idx} shadow-2xl bg-white relative overflow-hidden shrink-0 group transition-all`, activeEditIdx === idx && "ring-4 ring-blue-500 shadow-blue-200")} style={{ width: pWidth, height: pHeight, padding: `${marginT}in ${marginR}in ${marginB}in ${marginL}in`, lineHeight: '1.2', boxSizing: 'border-box', border: borderCss }}>
                    <div className="no-print absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 flex gap-2"><Button size="sm" variant={activeEditIdx === idx ? 'default' : 'secondary'} className="gap-2 font-bold shadow-lg" onClick={() => setActiveEditIdx(idx)}><Edit3 className="w-3.5 h-3.5" /> এডিট করুন</Button><Button size="sm" variant="destructive" className="gap-2 font-bold shadow-lg" onClick={() => { if(!confirm("মুছে ফেলবেন?")) return; const newP = paginatedPages.filter((_, i) => i !== idx); setPaginatedPages(newP); }}><Trash2 className="w-3.5 h-3.5" /> মুছে ফেলুন</Button></div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden" style={{ opacity: (printSettings.watermarkOpacity || 0) / 100, transform: `rotate(${printSettings.watermarkRotation || 0}deg)`, whiteSpace: 'nowrap' }}>
                      {printSettings.watermarkType === 'image' && printSettings.watermarkImageUrl ? (<img src={printSettings.watermarkImageUrl} alt="Watermark" style={{ width: `${printSettings.watermarkImageSize || 70}%`, height: 'auto', objectFit: 'contain' }} />) : (<span className="font-black text-black" style={{ fontSize: `${(printSettings.watermarkImageSize || 80) * 1.2}pt` }}>{printSettings.watermarkText || data.institution || softwareConfig?.appName || 'টপ গ্রেড'}</span>)}
                    </div>
                    <div className="relative z-10 flex flex-col h-full text-black">
                      <header className="text-center border-b-2 border-black pb-1 mb-2">
                        <h1 className="font-black text-[23px] text-black leading-tight">{data.institution || softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস'}</h1>
                        <div className="flex justify-center gap-8 text-[10pt] font-bold mt-1"><span>শ্রেণি: {CLASSES.find(c => c.id === data.classId)?.label || ''} শ্রেণি</span><span>বিষয়: {data.subject}</span></div>
                      </header>
                      {idx === 0 && <h2 className="text-[13pt] font-bold text-center underline uppercase mb-4">{data.topic || 'লেকচার শিট'}</h2>}
                      <EditableContentArea
                        initialHtml={manualPages[idx] !== undefined ? manualPages[idx] : pageHtml}
                        style={style}
                        cols={cols}
                        hasRule={hasRule}
                        isActive={activeEditIdx === idx}
                        pageIndex={idx}
                        totalPages={paginatedPages.length}
                        onFocus={() => setActiveEditIdx(idx)}
                        onClick={() => { if (activeEditIdx !== idx) setActiveEditIdx(idx); }}
                        onBlur={(val) => setManualPages(prev => ({ ...prev, [idx]: val }))}
                        onAddNextPage={handleAddNextPage}
                        onRemoveEmptyPage={handleRemoveEmptyPage}
                        onFocusPage={handleFocusPage}
                        onSyncPageContent={handleSyncPageContent}
                      />
                      <footer className="mt-auto pt-4 flex justify-between text-[9pt] font-bold border-t border-slate-200"><span>পাতা: {toBengaliNumber(idx + 1)} / {toBengaliNumber(paginatedPages.length)}</span><span>{softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস'}</span></footer>
                    </div>
                 </div>
               )})}
               <div className="no-print pt-4 pb-10"><Button onClick={() => setPaginatedPages(prev => [...prev, ""])} variant="outline" className="gap-2 border-2 border-dashed border-primary/50 text-primary font-black h-16 w-[8.27in] bg-white/50 hover:bg-white transition-all shadow-lg rounded-2xl"><PlusCircle className="w-6 h-6" /> নতুন পাতা যোগ করুন</Button></div>
            </main>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .math-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.85em; margin: 0 2px; }
        .math-num { border-bottom: 0.5pt solid black; padding: 0 1px; }
        .math-den { padding: 0 1px; }
        .math-dot { position: relative; display: inline-block; }
        .math-dot::after { content: "·"; position: absolute; top: -0.6em; left: 50%; transform: translateX(-50%); font-weight: bold; font-size: 1.2em; }
        .math-sqrt { display: inline-flex; align-items: center; }
        .math-sqrt-stem { border-top: 0.5pt solid black; padding-top: 1px; }
        .math-sup { font-size: 0.7em; vertical-align: super; }
        .math-sub { font-size: 0.7em; vertical-align: sub; }
        .math-text { font-family: 'Kalpurush', sans-serif; font-style: normal; }
        .katex { font-size: 1.15em; line-height: 1.2; text-indent: 0; text-rendering: auto; }
        .katex .mfrac .vlist-t { display: inline-table; table-layout: fixed; vertical-align: middle; }
        .katex .mfrac .frac-line { border-bottom: 1.5px solid currentColor !important; display: inline-block; width: 100%; min-height: 1.5px; }
        .content-area table { width: 100% !important; border-collapse: collapse !important; margin: 10px 0 !important; border: 1.5px solid #222 !important; }
        .content-area table td, .content-area table th { border: 1px solid #333 !important; min-width: 35px !important; height: 32px !important; min-height: 32px !important; padding: 8px 10px !important; vertical-align: top !important; word-break: break-word !important; }
        .content-area table th { background-color: #f1f5f9 !important; font-weight: bold !important; }
        .content-area p { margin: 0 0 4px 0; }
        @media screen {
          body { pointer-events: auto !important; }
          .paper { color: black !important; overflow: hidden; display: flex; flex-direction: column; }
          .callout-note-box { position: relative; }
          .callout-note-box .callout-delete-btn { opacity: 0.6; transition: opacity 0.2s, background 0.2s; }
          .callout-note-box:hover .callout-delete-btn { opacity: 1; }
          .callout-delete-btn:hover { background: #fee2e2 !important; color: #b91c1c !important; }
          .content-area { overflow: hidden; min-height: 0; flex: 1 1 0%; display: block; }
          .content-area table td, .content-area table th { cursor: text; user-select: text; -webkit-user-select: text; }
          .content-area table td:focus, .content-area table td:focus-visible { outline: 2px solid #2563eb !important; background-color: #eff6ff !important; }
          .content-area table td * { pointer-events: auto; }
          .no-arrows::-webkit-inner-spin-button, .no-arrows::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          .no-arrows { -moz-appearance: textfield; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        }
        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; width: 100% !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          .print-view-container { position: absolute !important; top: 0 !important; left: 0 !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; display: block !important; background: white !important; width: 100% !important; }
          .print-main-area { background: white !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; display: block !important; height: auto !important; position: static !important; width: 100% !important; }
          .paper { position: relative !important; margin: 0 !important; box-shadow: none !important; width: 8.27in !important; height: 11.69in !important; page-break-after: always !important; break-after: page !important; break-inside: avoid !important; display: block !important; box-sizing: border-box !important; border: none !important; overflow: hidden !important; }
          @page { size: A4; margin: 0 !important; }
        }
      `}} />
    </div>
  );
}

export default function CreateLectureSheetPage() { return <Suspense fallback={<div className="flex justify-center p-20 font-kalpurush"><Loader2 className="animate-spin text-primary" /></div>}><CreateLectureSheetContent /></Suspense>; }
