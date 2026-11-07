"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { formatQuestionToBoardStandardHtml, stripAnswers } from '@/lib/question-formatter';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  ArrowLeft, 
  Loader2, 
  Eye, 
  Trash2, 
  PlusCircle, 
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  ZoomIn,
  ZoomOut,
  Ruler,
  Columns2,
  Columns3,
  RectangleVertical,
  RectangleHorizontal,
  Square,
  Type,
  Palette,
  Edit3,
  BrainCircuit,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { WordToolbar } from '@/components/WordToolbar';
import { CLASSES } from '@/lib/constants';
import { generatePracticeQuestions } from '@/ai/flows/generate-practice-questions';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function stripDirtyHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  if (!html) return '';

  // 1. Repair any corrupted artifacts, leaked tags, or broken p style tags
  let cleaned = html
    .replace(/<\/p\s*>\s*<\s*p\s*style\s*=[^>]*0px0px4px[^>]*>/gi, '<br/>')
    .replace(/<\/p\s*>\s*<\s*p\s*style\s*=[^>]*margin[^>]*>/gi, '<br/>')
    .replace(/<\s*p\s*style\s*=[^>]*0px0px4px[^>]*>/gi, '')
    .replace(/<=""\s*span="">/gi, '')
    .replace(/<\/span">/gi, '')
    .replace(/<span\s+a<=""\s*span="">/gi, '')
    .replace(/data-index-in-node="[^"]*"/gi, '')
    .replace(/&lt;(\/?(?:p|span|div|b|strong|em|h[1-6]))&gt;/gi, '<$1>')
    .replace(/ba\\right\)\^n/g, '(ab)^n');

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

  // 4. Convert inline <br> within paragraphs into independent <p> blocks (Word-like paragraph separation)
  tmp.querySelectorAll('p, div').forEach((block) => {
    if (block.closest('table') || block.closest('.katex') || block.closest('.math-frac')) return;
    if (block.querySelector('br')) {
      const parts = block.innerHTML.split(/<br\s*\/?>/i);
      if (parts.length > 1) {
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          const trimmed = part.trim();
          if (trimmed !== '') {
            const newP = document.createElement('p');
            newP.style.margin = '0 0 4px 0';
            newP.innerHTML = part;
            frag.appendChild(newP);
          }
        });
        if (frag.childNodes.length > 0) {
          block.parentNode?.replaceChild(frag, block);
        }
      }
    }
  });

  // 5. Convert <li> inside lists to independent controllable <p> with margin-left
  tmp.querySelectorAll('ul, ol').forEach((list) => {
    if (list.closest('table')) return;
    const frag = document.createDocumentFragment();
    list.querySelectorAll('li').forEach((li) => {
      const p = document.createElement('p');
      p.style.margin = '0 0 4px 0';
      p.style.marginLeft = '0.35in';
      p.innerHTML = li.innerHTML;
      frag.appendChild(p);
    });
    if (frag.childNodes.length > 0) {
      list.parentNode?.replaceChild(frag, list);
    }
  });

  // 6. Convert blockquotes to independent <p> with margin-left
  tmp.querySelectorAll('blockquote').forEach((bq) => {
    const frag = document.createDocumentFragment();
    Array.from(bq.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        (child as HTMLElement).style.marginLeft = '0.35in';
        frag.appendChild(child);
      } else if (child.textContent?.trim()) {
        const p = document.createElement('p');
        p.style.margin = '0 0 4px 0';
        p.style.marginLeft = '0.35in';
        p.textContent = child.textContent;
        frag.appendChild(p);
      }
    });
    if (frag.childNodes.length > 0) {
      bq.parentNode?.replaceChild(frag, bq);
    }
  });

  // 7. Convert Gemini leading non-breaking spaces or tabs into clean, adjustable margin-left
  tmp.querySelectorAll('p, div').forEach((block) => {
    if (block.closest('table') || block.closest('.katex') || block.closest('.math-frac')) return;
    const match = block.innerHTML.match(/^([\s\t]|&nbsp;|&emsp;|&ensp;|\u00A0|\u2003)+/i);
    if (match && match[0].length >= 2) {
      const currentMl = parseFloat((block as HTMLElement).style.marginLeft || '0') || 0;
      if (currentMl === 0) {
        (block as HTMLElement).style.marginLeft = '0.35in';
      }
      block.innerHTML = block.innerHTML.replace(/^([\s\t]|&nbsp;|&emsp;|&ensp;|\u00A0|\u2003)+/i, '');
    }
  });

  return tmp.innerHTML;
}

// যে-কোনো প্যারাগ্রাফ বা ব্লককে সব ধরণের স্পেস, মার্জিন ও প্যাডিং মুছে ০ মার্জিনে রিসেট করার পাওয়ারফুল হেল্পার
function resetBlockToZero(block: HTMLElement, contentArea?: HTMLElement | null): HTMLElement {
  let target = block;

  // ১. যদি ব্লকটি <li> হয়, সেটিকে মুক্ত ও স্বাধীন <p> ট্যাগে রূপান্তর করুন
  if (target.tagName === 'LI') {
    const parentList = target.closest('ul, ol');
    const p = document.createElement('p');
    p.style.margin = '0 0 4px 0';
    p.innerHTML = target.innerHTML;
    if (parentList) {
      if (contentArea && parentList.parentElement === contentArea && parentList.children.length === 1) {
        contentArea.replaceChild(p, parentList);
      } else {
        parentList.parentNode?.insertBefore(p, parentList);
        target.remove();
      }
    } else {
      target.parentNode?.replaceChild(p, target);
    }
    target = p;
  }

  // ২. ইনলাইন সব মার্জিন ও প্যাডিং ০ করুন
  target.style.marginLeft = '';
  target.style.paddingLeft = '';
  target.style.textIndent = '';
  target.style.marginInlineStart = '';
  target.style.paddingInlineStart = '';

  // ৩. প্যারেন্ট কোনো র‍্যাপার থাকলে (যেমন blockquote বা div) তারও মার্জিন ০ করুন
  let pNode = target.parentElement;
  while (pNode && pNode !== contentArea && pNode.tagName !== 'BODY') {
    pNode.style.marginLeft = '';
    pNode.style.paddingLeft = '';
    pNode.style.textIndent = '';
    pNode.style.marginInlineStart = '';
    pNode.style.paddingInlineStart = '';
    pNode = pNode.parentElement;
  }

  // ৩.৫. blockquote বা nested div থেকে unwrap করুন
  if (target.tagName === 'BLOCKQUOTE' || (target.tagName === 'DIV' && target.className.includes('indent'))) {
    const p = document.createElement('p');
    p.style.margin = '0 0 4px 0';
    p.innerHTML = target.innerHTML;
    target.parentNode?.replaceChild(p, target);
    target = p;
  }

  // ৪. সব ধরণের ইউনিকোড স্পেস, &nbsp;, &emsp;, ট্যাব, ফাঁকা স্প্যান মুছে ফেলুন
  const spaceRegex = /^([\s\t\r\n]|&nbsp;|&emsp;|&ensp;|&#160;|&#8195;|&#8194;|\u00A0|\u2000|\u2001|\u2002|\u2003|\u2004|\u2005|\u2006|\u2007|\u2008|\u2009|\u200A|\u3000)+/gi;
  target.innerHTML = target.innerHTML
    .replace(spaceRegex, '')
    .replace(/^<span[^>]*>([\s\t]|&nbsp;|&emsp;|\u00A0)*<\/span>/gi, '')
    .replace(spaceRegex, '');

  // ৪.৫. style attribute-এ margin-left থাকলে সরাসরি সরান (inline style string)
  const styleAttr = target.getAttribute('style') || '';
  if (styleAttr) {
    const cleaned = styleAttr
      .replace(/margin-left\s*:[^;]+;?/gi, '')
      .replace(/padding-left\s*:[^;]+;?/gi, '')
      .replace(/text-indent\s*:[^;]+;?/gi, '')
      .replace(/margin-inline-start\s*:[^;]+;?/gi, '')
      .replace(/padding-inline-start\s*:[^;]+;?/gi, '')
      .trim();
    if (cleaned) {
      target.setAttribute('style', cleaned);
    } else {
      target.removeAttribute('style');
    }
  }

  // ৫. চাইল্ড নোডগুলোতেও মার্জিন সাফ করুন
  target.querySelectorAll('*').forEach((child) => {
    const cel = child as HTMLElement;
    if (cel.style) {
      if (cel.style.marginLeft) cel.style.marginLeft = '';
      if (cel.style.paddingLeft) cel.style.paddingLeft = '';
      if (cel.style.textIndent) cel.style.textIndent = '';
      if (cel.style.marginInlineStart) cel.style.marginInlineStart = '';
      if (cel.style.paddingInlineStart) cel.style.paddingInlineStart = '';
    }
    // Also clean style attribute string for any child
    const cs = cel.getAttribute('style') || '';
    if (cs && (cs.includes('margin-left') || cs.includes('padding-left') || cs.includes('text-indent'))) {
      const cc = cs.replace(/margin-left\s*:[^;]+;?/gi, '').replace(/padding-left\s*:[^;]+;?/gi, '').replace(/text-indent\s*:[^;]+;?/gi, '').trim();
      if (cc) cel.setAttribute('style', cc); else cel.removeAttribute('style');
    }
  });

  return target;
}

function repairLatex(math: string): string {
  if (!math) return '';
  return math.replace(/\\left\(([\s\S]*?)(?:\\right)?\)/g, (match, inner) => {
    if (inner.includes('\\right')) return match;
    return `\\left(${inner}\\right)`;
  });
}

function formatMath(text: string): string {
  if (!text) return '';
  text = stripDirtyHtml(text);

  // Clean markdown headers like # or ## or ### into bold title (even if inside <p>)
  text = text.replace(/(?:^|<p[^>]*>)\s*#{1,6}\s*(.*?)(?:<\/p>|$)/gim, '<p style="font-weight: bold; font-size: 1.1em; margin: 6px 0 3px 0;">$1</p>');
  text = text.replace(/^#{1,6}\s*(.+)$/gm, '<p style="font-weight: bold; font-size: 1.1em; margin: 6px 0 3px 0;">$1</p>');

  // Convert markdown bold **text** to <strong>text</strong>
  text = text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^\*])\*([^\*]+?)\*([^\*]|$)/g, '$1<strong>$2</strong>$3');

  // Convert bullet points starting with * or - into clean •
  text = text.replace(/(?:^|<p[^>]*>)\s*[\*\-]\s+/gim, '<p style="margin: 0 0 4px 0;">• ');

  // Convert markdown blockquotes > text
  text = text.replace(/^>\s*(.+)$/gm, '<p style="margin: 0 0 4px 0; padding-left: 0.25in; border-left: 2px solid #cbd5e1;">$1</p>');

  // Repair unbalanced LaTeX (e.g. \left( without matching \right)
  text = repairLatex(text);

  // Decode common HTML entities that might interfere with LaTeX math (<, >, &)
  text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  // 1. Convert $$ ... $$ (display math) with output: 'html' (prevents unstyled MathML stacking)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: true, output: 'html' });
    } catch {
      return `$$${math}$$`;
    }
  });

  // 2. Convert $ ... $ (inline math) with output: 'html'
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return `$${math}$`;
    }
  });

  // 3. Convert \[ ... \] and \( ... \)
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

  // 4. Convert \left( ... \right) with exponents and operators without $
  const leftRightRegex = /\\left\([\s\S]*?\\right\)(?:\^\{[^}]+\}|\^[\w\d-]+)?(?:\s*(?:\\times|\\cdot|\+|-|\/|\*|=)\s*(?:\\left\([\s\S]*?\\right\)(?:\^\{[^}]+\}|\^[\w\d-]+)?|[0-9a-zA-Z\\]+))*(?:\s*=\s*[0-9a-zA-Z]+)?/g;
  text = text.replace(leftRightRegex, (math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return math;
    }
  });

  // 5. Letter with complex exponent, e.g. A^{\frac{1}{pq}} \times B^{\frac{1}{qr}} \times C^{\frac{1}{rp}} = 1
  const letterFracExpRegex = /[A-Za-z]\^\{[^{}]*(?:\\frac\{[^{}]+\}\{[^{}]+\}[^{}]*)*\}(?:\s*(?:\\times|\\cdot|\+|-|\*|=)\s*[A-Za-z]\^\{[^{}]*(?:\\frac\{[^{}]+\}\{[^{}]+\}[^{}]*)*\})*(?:\s*=\s*[0-9a-zA-Z]+)?/g;
  text = text.replace(letterFracExpRegex, (math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return math;
    }
  });

  // 6. Standalone or chained \sqrt expressions, e.g. \sqrt[3]{7^2} \cdot \sqrt[3]{7}
  const sqrtChainedRegex = /\\sqrt(?:\[[^\]]+\])?\{[^}]+\}(?:\s*(?:\\cdot|\\times|\+|-|\/|\*|=)\s*\\sqrt(?:\[[^\]]+\])?\{[^}]+\})*/g;
  text = text.replace(sqrtChainedRegex, (math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return math;
    }
  });

  // 7. Convert standalone \frac{...}{...}
  text = text.replace(/\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, (match, num, den) => {
    try {
      return katex.renderToString(`\\frac{${num}}{${den}}`, { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return `<span class="math-frac"><span class="math-num">${num}</span><span class="math-den">${den}</span></span>`;
    }
  });

  // 8. Standalone \log expressions: \log_a M, \log_a(M \times N), etc.
  const logRegex = /\\log(?:_[a-zA-Z0-9]+|_\{[^}]+\})?(?:\s*(?:\([^)]+\)|[a-zA-Z0-9]+))?(?:\s*(?:=|\+|-|\*|\/|\\times|\\cdot)\s*\\log(?:_[a-zA-Z0-9]+|_\{[^}]+\})?(?:\s*(?:\([^)]+\)|[a-zA-Z0-9]+))?)*/g;
  text = text.replace(logRegex, (match) => {
    if (!match.includes('\\log')) return match;
    try {
      return katex.renderToString(match.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return match;
    }
  });

  // 9. Format Science Symbols (Physics, Chemistry, Geometry, Mathematics, Logic)
  text = text
    .replace(/\\vec\{([a-zA-Z])\}/g, '$1⃗')
    .replace(/\\angle/g, '∠')
    .replace(/\\triangle/g, '△')
    .replace(/\\perp/g, '⊥')
    .replace(/\\parallel/g, '∥')
    .replace(/\\cong/g, '≅')
    .replace(/\\sim(?![a-zA-Z])/g, '~')
    .replace(/\\circ/g, '°')
    .replace(/\\rightarrow|\\to|\\longrightarrow/g, ' → ')
    .replace(/\\rightleftharpoons/g, ' ⇌ ')
    .replace(/\\uparrow/g, ' ↑ ')
    .replace(/\\downarrow/g, ' ↓ ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\mu/g, 'µ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\pi/g, 'π')
    .replace(/\\rho/g, 'ρ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\tau/g, 'τ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\times/g, ' × ')
    .replace(/\\cdot/g, ' · ')
    .replace(/\\div/g, ' ÷ ')
    .replace(/\\pm/g, ' ± ')
    .replace(/\\mp/g, ' ∓ ')
    .replace(/\\neq/g, ' ≠ ')
    .replace(/\\ne(?![a-zA-Z])/g, ' ≠ ')
    .replace(/\\ge(?![a-zA-Z])/g, ' ≥ ')
    .replace(/\\le(?![a-zA-Z])/g, ' ≤ ')
    .replace(/\\approx/g, ' ≈ ')
    .replace(/\\equiv/g, ' ≡ ')
    .replace(/\\propto/g, ' ∝ ')
    .replace(/\\infty/g, ' ∞ ')
    .replace(/\\therefore/g, ' ∴ ')
    .replace(/\\because/g, ' ∵ ')
    .replace(/\\in(?![a-zA-Z])/g, ' ∈ ')
    .replace(/\\notin/g, ' ∉ ')
    .replace(/\\subset/g, ' ⊂ ')
    .replace(/\\subseteq/g, ' ⊆ ')
    .replace(/\\cup/g, ' ∪ ')
    .replace(/\\cap/g, ' ∩ ')
    .replace(/\\emptyset/g, ' ∅ ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\mathbb\{Q\}/g, 'ℚ')
    .replace(/\\mathbb\{C\}/g, 'ℂ');

  // Strip any remaining unwanted stray * and # characters (ensuring no * or # remains in text)
  text = text.replace(/[*#]/g, '');

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

// Accurately measure the bottom of content inside a container (works even when clientHeight is fixed)
function getContentBottom(el: HTMLElement): number {
  if (el.childNodes.length === 0) return 0;
  let maxBottom = 0;
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i] as HTMLElement;
    const childRect = child.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const bottom = childRect.bottom - elRect.top;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rect = range.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const rangeBottom = rect.bottom - elRect.top;
    if (rangeBottom > maxBottom) maxBottom = rangeBottom;
  } catch {}
  return maxBottom;
}

function getContentRight(el: HTMLElement): number {
  if (el.childNodes.length === 0) return 0;
  let maxRight = 0;
  const elRect = el.getBoundingClientRect();
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i] as HTMLElement;
    const childRect = child.getBoundingClientRect();
    const right = childRect.right - elRect.left;
    if (right > maxRight) maxRight = right;
  }
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rect = range.getBoundingClientRect();
    const rangeRight = rect.right - elRect.left;
    if (rangeRight > maxRight) maxRight = rangeRight;
  } catch {}
  return maxRight;
}



interface WordRulerProps {
  paperWidthInches: number;
  marginLeft: number;
  marginRight: number;
  zoomLevel: number;
  onMarginChange: (left: number, right: number) => void;
  tabStops?: number[];
  onTabStopsChange?: (stops: number[]) => void;
  activeLineIndent?: number; // কারসর থাকা লাইনের ইন্ডেন্ট (ইঞ্চি)
  activeRulerPos?: number; // ডকুমেন্টে কারসর লাইনের এক্সাক্ট রুলার অবস্থান (ইঞ্চি)
  onLineIndentChange?: (newIndentInches: number) => void;
}

function WordRuler({
  paperWidthInches,
  marginLeft,
  marginRight,
  zoomLevel,
  onMarginChange,
  tabStops = [],
  onTabStopsChange = () => {},
  activeLineIndent = 0,
  activeRulerPos,
  onLineIndentChange = () => {},
}: WordRulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'left' | 'right' | 'lineIndent' | number | null>(null);
  const [guideX, setGuideX] = useState<number | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const totalInches = Math.floor(paperWidthInches);
  const effectiveRulerPos = (typeof activeRulerPos === 'number' && activeRulerPos > 0)
    ? activeRulerPos
    : (marginLeft + activeLineIndent);

  // Click on ruler to add a new Tab Stop 'L' point & move current line to that point
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const zoom = (zoomLevel || 100) / 100;
    const clickPx = (e.clientX - rect.left) / zoom;
    const clickInches = Math.round((clickPx / 96) * 16) / 16;

    if (clickInches >= marginLeft && clickInches <= paperWidthInches - marginRight - 0.1) {
      const exists = tabStops.some(p => Math.abs(p - clickInches) < 0.1);
      if (!exists) {
        const next = [...tabStops, clickInches].sort((a, b) => a - b);
        onTabStopsChange(next);
      }
      // কারসর থাকা লাইনের ইন্ডেন্ট এই পয়েন্টে সেট করুন
      const lineRelIndent = Math.max(0, clickInches - marginLeft);
      onLineIndentChange(lineRelIndent);
    }
  };

  const handleMouseDownMargin = (type: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(type);

    const startX = e.clientX;
    const startLeft = marginLeft;
    const startRight = marginRight;

    const onMove = (moveEvt: MouseEvent) => {
      const zoom = (zoomLevel || 100) / 100;
      const deltaX = (moveEvt.clientX - startX) / zoom;
      const deltaInches = deltaX / 96;

      if (type === 'left') {
        const rawNewLeft = Math.round((startLeft + deltaInches) * 16) / 16;
        const newLeft = Math.max(0.125, Math.min(paperWidthInches - marginRight - 1.0, rawNewLeft));
        onMarginChange(newLeft, marginRight);
        setActiveTooltip(`বাম মার্জিন: ${newLeft.toFixed(2)}"`);
      } else {
        const rawNewRight = Math.round((startRight - deltaInches) * 16) / 16;
        const newRight = Math.max(0.125, Math.min(paperWidthInches - marginLeft - 1.0, rawNewRight));
        onMarginChange(marginLeft, newRight);
        setActiveTooltip(`ডান মার্জিন: ${newRight.toFixed(2)}"`);
      }
      setGuideX(moveEvt.clientX);
    };

    const onUp = () => {
      setDragging(null);
      setGuideX(null);
      setActiveTooltip(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Dragging the Active Line's 'L' Marker (কারসর থাকা লাইন সামনে/পিছনে সরানো)
  const handleMouseDownLineIndent = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging('lineIndent');

    const startX = e.clientX;
    const startRulerPos = effectiveRulerPos;
    const startIndent = activeLineIndent;

    const onMove = (moveEvt: MouseEvent) => {
      const zoom = (zoomLevel || 100) / 100;
      const deltaX = (moveEvt.clientX - startX) / zoom;
      const deltaInches = deltaX / 96;

      const rawNewIndent = Math.round((startIndent + deltaInches) * 16) / 16;
      const maxAllowed = paperWidthInches - marginLeft - marginRight - 0.5;
      const newIndent = Math.max(0, Math.min(maxAllowed, rawNewIndent));

      onLineIndentChange(newIndent);
      const displayPos = Math.max(marginLeft, Math.round((startRulerPos + (newIndent - startIndent)) * 16) / 16);
      setActiveTooltip(`কারসর লাইনের 'L' অবস্থান: ${displayPos.toFixed(2)}"`);
      setGuideX(moveEvt.clientX);
    };

    const onUp = () => {
      setDragging(null);
      setGuideX(null);
      setActiveTooltip(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleMouseDownTab = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(index);

    const startX = e.clientX;
    const startPos = tabStops[index];

    const onMove = (moveEvt: MouseEvent) => {
      const zoom = (zoomLevel || 100) / 100;
      const deltaX = (moveEvt.clientX - startX) / zoom;
      const deltaInches = deltaX / 96;

      const newPos = Math.max(
        marginLeft,
        Math.min(paperWidthInches - marginRight, Math.round((startPos + deltaInches) * 16) / 16)
      );

      const next = [...tabStops];
      next[index] = newPos;
      onTabStopsChange(next);

      // কারসর যে লাইনে আছে সেই লাইনের মার্জিনও এই L পয়েন্টের সাথে সাথে সামনে-পিছনে সরবে!
      const lineIndent = Math.max(0, newPos - marginLeft);
      onLineIndentChange(lineIndent);

      setActiveTooltip(`এল (L) পয়েন্ট / লাইন পজিশন: ${newPos.toFixed(2)}"`);
      setGuideX(moveEvt.clientX);
    };

    const onUp = (upEvt: MouseEvent) => {
      setDragging(null);
      setGuideX(null);
      setActiveTooltip(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      // If dragged vertically outside the ruler by more than 30px, remove it!
      if (rulerRef.current) {
        const rect = rulerRef.current.getBoundingClientRect();
        if (upEvt.clientY > rect.bottom + 30 || upEvt.clientY < rect.top - 20) {
          onTabStopsChange(tabStops.filter((_, i) => i !== index));
        }
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <>
      {/* Vertical Alignment Guide Line while dragging */}
      {guideX !== null && (
        <div
          className="pointer-events-none fixed top-0 bottom-0 z-50 border-r-2 border-dashed border-indigo-500 shadow-sm"
          style={{ left: guideX }}
        />
      )}

      <div
        ref={rulerRef}
        onClick={handleRulerClick}
        className="relative h-[26px] bg-[#2b3038] border-t border-b border-[#1c2025] select-none text-slate-200 font-sans text-[10px] overflow-visible rounded shadow-md cursor-crosshair"
        style={{ width: `${paperWidthInches}in` }}
        title="রুলারে ক্লিক করে নতুন পয়েন্ট (Tab Stop) যোগ করুন"
      >
        {/* 1. Left Margin Shaded Area (Darker Slate) */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-[#1e2329] border-r border-[#3a414b]"
          style={{ width: `${marginLeft}in` }}
        />

        {/* 2. Printable Center Area (Slightly lighter slate like Image 1) */}
        <div
          className="absolute top-0 bottom-0 bg-[#3a414b]"
          style={{ left: `${marginLeft}in`, right: `${marginRight}in` }}
        />

        {/* 3. Right Margin Shaded Area (Darker Slate) */}
        <div
          className="absolute top-0 bottom-0 right-0 bg-[#1e2329] border-l border-[#3a414b]"
          style={{ width: `${marginRight}in` }}
        />

        {/* 4. Inch Marks & Subdivisions (Dots & Bars matching Image 1) */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: totalInches + 1 }).map((_, inch) => (
            <React.Fragment key={inch}>
              {/* Full inch major mark */}
              <div
                className="absolute top-0 w-[1.5px] bg-slate-300 h-2"
                style={{ left: `${inch}in` }}
              />
              {inch < totalInches && (
                <span
                  className="absolute bottom-1 font-semibold text-[9px] -translate-x-1/2 text-slate-200 tracking-tight"
                  style={{ left: `${inch + 1}in` }}
                >
                  {inch + 1}
                </span>
              )}
              {/* 1/2 inch dot */}
              {inch + 0.5 < paperWidthInches && (
                <div
                  className="absolute top-1.5 w-1 h-1 rounded-full bg-slate-300 -translate-x-1/2"
                  style={{ left: `${inch + 0.5}in` }}
                />
              )}
              {/* 1/4 and 3/4 inch small dots */}
              {inch + 0.25 < paperWidthInches && (
                <div
                  className="absolute top-1.5 w-0.5 h-0.5 rounded-full bg-slate-400 -translate-x-1/2"
                  style={{ left: `${inch + 0.25}in` }}
                />
              )}
              {inch + 0.75 < paperWidthInches && (
                <div
                  className="absolute top-1.5 w-0.5 h-0.5 rounded-full bg-slate-400 -translate-x-1/2"
                  style={{ left: `${inch + 0.75}in` }}
                />
              )}
              {/* 1/8 and 3/8 inch tiny tick */}
              {inch + 0.125 < paperWidthInches && (
                <div
                  className="absolute top-0 w-px h-1 bg-slate-500"
                  style={{ left: `${inch + 0.125}in` }}
                />
              )}
              {inch + 0.375 < paperWidthInches && (
                <div
                  className="absolute top-0 w-px h-1 bg-slate-500"
                  style={{ left: `${inch + 0.375}in` }}
                />
              )}
              {inch + 0.625 < paperWidthInches && (
                <div
                  className="absolute top-0 w-px h-1 bg-slate-500"
                  style={{ left: `${inch + 0.625}in` }}
                />
              )}
              {inch + 0.875 < paperWidthInches && (
                <div
                  className="absolute top-0 w-px h-1 bg-slate-500"
                  style={{ left: `${inch + 0.875}in` }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* 5. User-placed 'L' Tab Stop Points (শুধুমাত্র ব্যবহারকারী রুলারে ক্লিক করে তৈরি করলে দেখা যাবে) */}
        {tabStops.map((pos, idx) => (
          <div
            key={idx}
            onMouseDown={(e) => handleMouseDownTab(idx, e)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onTabStopsChange(tabStops.filter((_, i) => i !== idx));
            }}
            className="absolute bottom-0 z-30 cursor-ew-resize group -ml-1 w-3.5 h-4 flex items-end justify-center"
            style={{ left: `${pos}in` }}
            title={`ট্যাব পয়েন্ট 'L': ${pos.toFixed(2)}" (টেনে কারসর লাইন সরান, ডাবল-ক্লিকে মুছুন)`}
          >
            {/* Iconic 'L' mark as seen in Word */}
            <div className="w-2.5 h-3 border-l-2 border-b-2 border-slate-100 drop-shadow hover:border-amber-400 transition-colors pointer-events-none" />
          </div>
        ))}

        {/* 6. Active Cursor Line 'L' Indent Marker (কারসর যে লাইনে আছে তার অবস্থান নির্দেশক 'L' মার্কার) */}
        <div
          onMouseDown={handleMouseDownLineIndent}
          className="absolute bottom-0 z-40 cursor-ew-resize group -ml-2 w-5 h-6 flex flex-col items-center justify-end select-none"
          style={{ left: `${effectiveRulerPos}in` }}
          title={`কারসর লাইনের 'L' অবস্থান: ${effectiveRulerPos.toFixed(2)}" (টেনে কারসর থাকা লাইনটি সামনে/পিছনে সরান)`}
        >
          {/* Top Downward pointer */}
          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-amber-300 drop-shadow group-hover:border-t-amber-400 mb-0.5" />
          {/* Iconic Yellow 'L' symbol representing Word Tab / Indent */}
          <div className="w-3.5 h-4 border-l-[3px] border-b-[3px] border-amber-300 drop-shadow-md group-hover:scale-125 group-hover:border-amber-400 transition-transform pointer-events-none" />
        </div>

        {/* 6.1 Page Margin Boundary Marker (পাতার মার্জিন পরিবর্তনকারী রেখা) */}
        {activeLineIndent > 0.05 && (
          <div
            onMouseDown={(e) => handleMouseDownMargin('left', e)}
            className="absolute top-0 bottom-0 z-30 cursor-ew-resize -ml-0.5 w-1 bg-indigo-400/60 hover:bg-indigo-400"
            style={{ left: `${marginLeft}in` }}
            title={`বাম মার্জিন সীমানা: ${marginLeft.toFixed(2)}" (টেনে পাতার মার্জিন পরিবর্তন করুন)`}
          />
        )}

        {/* 7. Right Margin Slider Marker (Classic Word Upward Triangle) */}
        <div
          onMouseDown={(e) => handleMouseDownMargin('right', e)}
          className="absolute bottom-0 z-40 cursor-ew-resize group -mr-2 w-4 flex flex-col items-center justify-end"
          style={{ right: `${marginRight}in` }}
          title={`ডান মার্জিন: ${marginRight.toFixed(2)} ইঞ্চি (টেনে পরিবর্তন করুন)`}
        >
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-slate-200 drop-shadow" />
        </div>

        {/* Active Tooltip showing exact measurement while dragging */}
        {activeTooltip && (
          <div
            className="absolute top-7 z-50 bg-slate-900/95 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap pointer-events-none border border-slate-700"
            style={{
              left:
                dragging === 'left'
                  ? `${marginLeft}in`
                  : dragging === 'right'
                  ? `calc(${paperWidthInches - marginRight}in - 40px)`
                  : dragging === 'lineIndent'
                  ? `${marginLeft + activeLineIndent}in`
                  : typeof dragging === 'number'
                  ? `${tabStops[dragging]}in`
                  : '50%',
            }}
          >
            {activeTooltip}
          </div>
        )}
      </div>
    </>
  );
}

// লাইন/অনুচ্ছেদ সরানোর হ্যান্ডেল কম্পোনেন্ট
function ParagraphMoveHandles({
  contentRef,
  onMoveParagraph,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  onMoveParagraph: (idx: number, direction: 'up' | 'down') => void;
}) {
  const [handles, setHandles] = useState<{ top: number; height: number; idx: number; total: number }[]>([]);

  useEffect(() => {
    const update = () => {
      const el = contentRef.current;
      if (!el) return;
      const elRect = el.getBoundingClientRect();
      const children = Array.from(el.children);
      const total = children.length;
      const newHandles = children.map((child, idx) => {
        const rect = (child as HTMLElement).getBoundingClientRect();
        return {
          top: rect.top - elRect.top,
          height: Math.max(rect.height, 18),
          idx,
          total,
        };
      });
      setHandles(newHandles);
    };
    update();
    const el = contentRef.current;
    if (!el) return;
    const obs = new MutationObserver(update);
    obs.observe(el, { childList: true, subtree: false, characterData: false });
    window.addEventListener('resize', update);
    return () => { obs.disconnect(); window.removeEventListener('resize', update); };
  }, [contentRef]);

  if (handles.length <= 1) return null;

  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none"
      style={{ left: '-26px', width: '24px' }}
    >
      {handles.map(({ top, height, idx, total }) => (
        <div
          key={idx}
          className="absolute flex flex-col items-center justify-center gap-px pointer-events-auto"
          style={{ top: `${top}px`, height: `${height}px`, width: '22px' }}
        >
          {idx > 0 && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onMoveParagraph(idx, 'up'); }}
              className="w-5 h-3.5 bg-blue-100 hover:bg-blue-500 hover:text-white text-blue-600 border border-blue-300 rounded text-[8px] flex items-center justify-center transition-colors shadow-sm opacity-50 hover:opacity-100"
              title="উপরে নিন"
            >▲</button>
          )}
          {idx < total - 1 && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onMoveParagraph(idx, 'down'); }}
              className="w-5 h-3.5 bg-blue-100 hover:bg-blue-500 hover:text-white text-blue-600 border border-blue-300 rounded text-[8px] flex items-center justify-center transition-colors shadow-sm opacity-50 hover:opacity-100"
              title="নিচে নিন"
            >▼</button>
          )}
        </div>
      ))}
    </div>
  );
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

      const isColumnMode = cols > 1;
      const isElOverflowing = () => {
        if (isColumnMode) {
          if (el.scrollWidth > el.clientWidth + 6) return true;
          if (el.scrollHeight > maxH + 4) return true;
          const maxR = getContentRight(el);
          if (maxR > el.clientWidth + 6) return true;
          return false;
        }
        const curBottom = getContentBottom(el);
        return (el.scrollHeight > maxH + 3 || curBottom > maxH + 3);
      };

      // 1. OVERFLOW: content exceeds available page clientHeight or column capacity
      if (isElOverflowing()) {
        const overflowNodes: Node[] = [];

        // Remove last child nodes until content fits inside page
        while (isElOverflowing() && el.childNodes.length > 1) {
          const last = el.lastChild;
          if (!last) break;
          el.removeChild(last);
          overflowNodes.unshift(last);
        }

        // If single large child remains and still overflows, extract its child nodes
        if (isElOverflowing() && el.firstChild && el.firstChild.nodeType === Node.ELEMENT_NODE) {
          const onlyChild = el.firstChild as HTMLElement;
          if (onlyChild.childNodes.length > 1) {
            const innerOverflow: Node[] = [];
            while (isElOverflowing() && onlyChild.childNodes.length > 1) {
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
              window.dispatchEvent(new CustomEvent('reflow-page', { detail: { pageIndex: pageIndex + 1, allowUnderflow: true } }));
            }, 30);
          } else {
            onSyncPageContent(pageIndex, el.innerHTML);
            onAddNextPage(overflowHtml);
          }
        }
      }
      // 2. UNDERFLOW: empty space available in this page, pull up from next page (Word-like text pulling)
      else if (allowUnderflow) {
        const nextEl = document.querySelector(`.paper-idx-${pageIndex + 1} .content-area`) as HTMLDivElement | null;
        if (nextEl && nextEl.childNodes.length > 0) {
          // If nextEl content is wrapped in a single container element, unwrap it first
          if (nextEl.childNodes.length === 1 && nextEl.firstChild && nextEl.firstChild.nodeType === Node.ELEMENT_NODE) {
            const wrapper = nextEl.firstChild as HTMLElement;
            if (wrapper.tagName === 'DIV' || wrapper.tagName === 'SECTION' || wrapper.tagName === 'ARTICLE') {
              if (wrapper.childNodes.length > 1) {
                while (wrapper.firstChild) {
                  nextEl.insertBefore(wrapper.firstChild, wrapper);
                }
                nextEl.removeChild(wrapper);
              }
            }
          }

          let movedCount = 0;
          while (nextEl.childNodes.length > 0) {
            const firstNode = nextEl.firstChild!;
            el.appendChild(firstNode);
            if (isElOverflowing()) {
              // Exceeded page capacity, put back to nextEl
              nextEl.insertBefore(firstNode, nextEl.firstChild);
              break;
            }
            movedCount++;
          }

          if (movedCount > 0) {
            onSyncPageContent(pageIndex, el.innerHTML);
            onSyncPageContent(pageIndex + 1, nextEl.innerHTML);
            const nextText = nextEl.innerText?.trim() || '';
            const nextHtmlClean = nextEl.innerHTML.replace(/<[^>]*>/g, '').trim();
            if (nextText === '' && nextHtmlClean === '' && nextEl.querySelectorAll('img, table').length === 0) {
              if (totalPages > 1) {
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
  }, [pageIndex, totalPages, cols, onAddNextPage, onRemoveEmptyPage, onSyncPageContent]);

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



  // Load initial content once on mount
  useEffect(() => {
    if (ref.current && !isLoadedRef.current) {
      ref.current.innerHTML = formatMath(stripDirtyHtml(initialHtml));
      isLoadedRef.current = true;
      setTimeout(() => {
        checkAndReflow(false);
      }, 60);
    }
  }, []);

  // plain text থেকে LaTeX সহ HTML তৈরি করে (KaTeX render সহ, output: 'html')
  const renderMathInText = (text: string): string => {
    let clean = text
      .replace(/<=""\s*span="">/gi, '')
      .replace(/<\/span">/gi, '')
      .replace(/=""/g, '');

    const lines = clean.split('\n');
    const htmlLines = lines.map((line) => {
      if (line.trim() === '') return '<p style="margin:0 0 4px 0;padding:0"><br/></p>';

      const leadingMatch = line.match(/^([\s\t]|&nbsp;|&emsp;)+/);
      let indentStyle = '';
      let contentLine = line;
      if (leadingMatch && leadingMatch[0].length >= 2) {
        const spaceCount = leadingMatch[0].replace(/\t/g, '    ').length;
        const indentInches = Math.min(2.0, Math.round((spaceCount * 0.08) * 16) / 16);
        if (indentInches > 0) {
          indentStyle = `margin-left:${indentInches}in;`;
        }
        contentLine = line.slice(leadingMatch[0].length);
      }

      const formatted = formatMath(contentLine);
      return `<p style="margin:0 0 4px 0;padding:0;${indentStyle}">${formatted}</p>`;
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
    const hasMath = /\$|\\frac|\\sqrt|\\left|\\right|\\times|\\cdot|\\log|\\pm|\\ge|\\le|\\ne|\\in|\\mathbb|\^[0-9a-zA-Z{]/.test(plainText || '');

    // 1. If text has LaTeX ($...$ or \[...\] or \frac, \left, etc.) OR is from Gemini: ALWAYS use plainText + KaTeX
    if (plainText && (isGemini || hasMath)) {
      const renderedHtml = renderMathInText(plainText);
      const fragment = range.createContextualFragment(renderedHtml);
      range.insertNode(fragment);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      setTimeout(() => {
        checkAndReflow(true);
        if (onSyncPageContent && ref.current) {
          onSyncPageContent(pageIndex, ref.current.innerHTML);
        }
      }, 40);
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
      setTimeout(() => {
        checkAndReflow(true);
        if (onSyncPageContent && ref.current) {
          onSyncPageContent(pageIndex, ref.current.innerHTML);
        }
      }, 40);
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
      setTimeout(() => {
        checkAndReflow(true);
        if (onSyncPageContent && ref.current) {
          onSyncPageContent(pageIndex, ref.current.innerHTML);
        }
      }, 40);
    }
  };

  const handleInput = () => {
    if (inputTimerRef.current) clearTimeout(inputTimerRef.current);
    inputTimerRef.current = setTimeout(() => {
      checkAndReflow(true);
      if (onSyncPageContent && ref.current) {
        onSyncPageContent(pageIndex, ref.current.innerHTML);
      }
    }, 60);
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

        // Table cell না হলে: কারসর যে লাইনে আছে সেই লাইনের মার্জিন সামনে/পিছনে সরান (Tab = সামনে, Shift+Tab = পিছনে)
        e.preventDefault();
        let targetBlock: HTMLElement | null = null;
        let currNode: Node | null = sel.anchorNode;
        while (currNode && currNode !== el) {
          if (currNode.nodeType === Node.ELEMENT_NODE && (currNode as HTMLElement).parentElement === el) {
            targetBlock = currNode as HTMLElement;
            break;
          }
          currNode = currNode.parentNode;
        }
        if (targetBlock) {
          if (e.shiftKey) {
            // Shift + Tab: সরাসরি পাতার শুরুতে রিসেট করুন
            targetBlock.style.marginLeft = '';
            targetBlock.style.paddingLeft = '';
            targetBlock.style.textIndent = '';
            targetBlock.innerHTML = targetBlock.innerHTML.replace(/^(\s|&nbsp;|\u00A0)+/, '');
            onSyncPageContent(pageIndex, el.innerHTML);
            setTimeout(updateActiveLineIndent, 30);
          } else {
            // Tab: ০.২৫ ইঞ্চি ডানে ইনডেন্ট করুন
            const currentPx = parseFloat(targetBlock.style.marginLeft || '0') || 0;
            const currentInches = currentPx > 0 ? (targetBlock.style.marginLeft.endsWith('in') ? currentPx : currentPx / 96) : 0;
            const newInches = Math.round((currentInches + 0.25) * 16) / 16;
            targetBlock.style.marginLeft = `${newInches}in`;
            onSyncPageContent(pageIndex, el.innerHTML);
            setTimeout(updateActiveLineIndent, 30);
          }
        }
        return;
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

      // Check if cursor is inside a flex container or flex child
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.anchorNode;
        let isInsideFlex = false;
        while (node && node !== el) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const h = node as HTMLElement;
            const style = window.getComputedStyle(h);
            if (style.display === 'flex' || style.display === 'inline-flex') {
              isInsideFlex = true;
              break;
            }
          }
          node = node.parentNode;
        }

        if (isInsideFlex) {
          e.preventDefault();
          document.execCommand('insertParagraph', false);
          const range = sel.getRangeAt(0);
          let currentEl = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? (range.startContainer as HTMLElement)
            : range.startContainer.parentElement;
          if (currentEl) {
            currentEl.style.display = 'block';
            currentEl.style.width = '100%';
          }
          setTimeout(() => checkAndReflow(false), 50);
          return;
        }
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

    // 5. Backspace -> মাইক্রোসফট ওয়ার্ডের মতো পারফেক্ট আচরণ:
    // ইনডেন্টেড লাইনের শুরুতে ব্যাকস্পেস দিলে লাইন কিছুতেই উপরে জোড়া লাগবে না, বরং সোজা বাম মার্জিনে (০ মার্জিনে) চলে আসবে!
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
        let blockNode: HTMLElement | null = null;
        let curr: Node | null = sel.anchorNode;
        while (curr && curr !== el) {
          if (curr.nodeType === Node.ELEMENT_NODE) {
            const tag = (curr as HTMLElement).tagName;
            if (/^(P|H[1-6]|LI|DIV|BLOCKQUOTE|TR)$/i.test(tag)) {
              blockNode = curr as HTMLElement;
              if (curr.parentElement === el) break;
            }
          }
          curr = curr.parentNode;
        }

        if (blockNode) {
          const range = sel.getRangeAt(0);

          // কারসরের পূর্বে এই ব্লকের কনটেন্ট চেক করি
          const preRange = document.createRange();
          preRange.selectNodeContents(blockNode);
          preRange.setEnd(range.startContainer, range.startOffset);
          const textBefore = preRange.toString();

          // চেক করি কারসরের ঠিক পূর্বে কোনো <br> আছে কি না (যদি একই ব্লকে একাধিক লাইন থাকে)
          let isJustAfterBr = false;
          const startNode = range.startContainer;
          const offset = range.startOffset;
          if (startNode.nodeType === Node.TEXT_NODE && offset === 0) {
            let prevSib: Node | null = startNode.previousSibling;
            while (prevSib && prevSib.nodeType === Node.TEXT_NODE && prevSib.textContent?.trim() === '') {
              prevSib = prevSib.previousSibling;
            }
            if (prevSib && prevSib.nodeName === 'BR') isJustAfterBr = true;
          } else if (startNode.nodeType === Node.ELEMENT_NODE && offset > 0) {
            const childBefore = startNode.childNodes[offset - 1];
            if (childBefore && childBefore.nodeName === 'BR') isJustAfterBr = true;
          }

          // যদি লাইনের শুরুতে থাকে (পূর্বে শুধুমাত্র স্পেস, nbsp বা কিছু নেই)
          const isAtStartOfText = /^([\s\t\r\n]|&nbsp;|&emsp;|\u00A0)*$/.test(textBefore);

          // চেক করি ব্লকে কি কোনো মার্জিন/ইনডেন্ট, লিডিং স্পেস, বা প্যারেন্ট ইনডেন্ট আছে?
          const hasInlineIndent = (parseFloat(blockNode.style.marginLeft || '0') > 0) ||
                                  (parseFloat(blockNode.style.paddingLeft || '0') > 0) ||
                                  (parseFloat(blockNode.style.textIndent || '0') > 0) ||
                                  blockNode.tagName === 'LI' ||
                                  blockNode.closest('blockquote, ul, ol') !== null;
          const hasLeadingSpaces = /^([\s\t]|&nbsp;|&emsp;|\u00A0)+/i.test(blockNode.innerHTML);

          if (isAtStartOfText && (hasInlineIndent || hasLeadingSpaces || textBefore.length > 0)) {
            // ওয়ার্ডের মতো লাইনটিকে সোজা বাম মার্জিনে (০ মার্জিনে) নিয়ে আসুন!
            e.preventDefault();
            const cleanedBlock = resetBlockToZero(blockNode, el);

            // কারসরকে লেখার শুরুতে সেট করি
            const newRange = document.createRange();
            newRange.selectNodeContents(cleanedBlock);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            onSyncPageContent(pageIndex, el.innerHTML);
            setTimeout(() => {
              checkAndReflow(true);
              updateActiveLineIndent();
            }, 30);
            return;
          }

          // যদি একই ব্লকে <br> এর পর নতুন লাইন থাকে এবং সেখানে ব্যাকস্পেস চাপা হয়:
          if (isJustAfterBr) {
            // উপরের লাইনে জোড়া না লাগিয়ে লাইন দুটিকে আলাদা দুটি স্বাধীন <p> এ বিভক্ত করুন
            e.preventDefault();
            const parts = blockNode.innerHTML.split(/<br\s*\/?>/i);
            if (parts.length > 1) {
              const frag = document.createDocumentFragment();
              let targetP: HTMLElement | null = null;
              parts.forEach((part, pIdx) => {
                const p = document.createElement('p');
                p.style.margin = '0 0 4px 0';
                p.innerHTML = part.replace(/^([\s\t]|&nbsp;|&emsp;|\u00A0)+/gi, '');
                frag.appendChild(p);
                if (pIdx === 1) targetP = p;
              });
              blockNode.parentNode?.replaceChild(frag, blockNode);
              if (targetP) {
                const newRange = document.createRange();
                newRange.selectNodeContents(targetP);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
              }
              onSyncPageContent(pageIndex, el.innerHTML);
              setTimeout(() => {
                checkAndReflow(true);
                updateActiveLineIndent();
              }, 40);
              return;
            }
          }
        }
      }

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
      setTimeout(() => {
        checkAndReflow(true);
        updateActiveLineIndent();
      }, 60);
      return;
    }

    // 6. Delete key -> pull up text if at end of page or deleting content
    if (e.key === 'Delete') {
      if (isCursorAtEnd(el) && pageIndex < totalPages - 1) {
        e.preventDefault();
        checkAndReflow(true);
        return;
      }
      setTimeout(() => checkAndReflow(true), 60);
    }
  };

  const updateActiveLineIndent = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const el = ref.current;
    if (!el) return;

    try {
      // Find the innermost block element containing the cursor
      let blockNode: HTMLElement | null = null;
      let curr: Node | null = sel.anchorNode;
      while (curr && curr !== el) {
        if (curr.nodeType === Node.ELEMENT_NODE) {
          const tag = (curr as HTMLElement).tagName;
          if (/^(P|H[1-6]|LI|DIV|BLOCKQUOTE|TR)$/i.test(tag)) {
            blockNode = curr as HTMLElement;
            if (curr.parentElement === el) break;
          }
        }
        curr = curr.parentNode;
      }

      if (!blockNode) return;

      const paperEl = el.closest('.paper') as HTMLElement | null;
      if (!paperEl) return;

      const zoom = (style.zoom || 100) / 100;
      const paperRect = paperEl.getBoundingClientRect();

      // Find where this line's first character/content physically starts on screen:
      let startX = 0;
      try {
        // Find first text node or child to measure text start accurately
        let firstTextNode: Node | null = blockNode.firstChild;
        while (firstTextNode && firstTextNode.firstChild) {
          firstTextNode = firstTextNode.firstChild;
        }
        if (firstTextNode && firstTextNode.nodeType === Node.TEXT_NODE) {
          const tr = document.createRange();
          tr.setStart(firstTextNode, 0);
          tr.setEnd(firstTextNode, Math.min(1, firstTextNode.textContent?.length || 1));
          const r = tr.getBoundingClientRect();
          if (r.left > 0) startX = r.left;
        }
      } catch {}

      if (startX === 0) {
        try {
          const range = document.createRange();
          range.selectNodeContents(blockNode);
          range.collapse(true);
          const rRect = range.getBoundingClientRect();
          if (rRect.left > 0) startX = rRect.left;
        } catch {}
      }

      if (startX === 0) {
        const firstChild = blockNode.firstElementChild || blockNode;
        startX = firstChild.getBoundingClientRect().left;
      }

      // Exact horizontal position on ruler in inches:
      const rawInches = (startX - paperRect.left) / (96 * zoom);
      const rulerPos = Math.max(0.1, Math.round(rawInches * 16) / 16);

      // Relative indent from block or paper marginLeft:
      let indentInches = 0;
      if (blockNode.style.marginLeft) {
        const ml = blockNode.style.marginLeft.trim();
        if (ml.endsWith('in')) {
          indentInches = parseFloat(ml) || 0;
        } else if (ml.endsWith('px')) {
          indentInches = (parseFloat(ml) || 0) / 96;
        }
      }
      if (indentInches === 0) {
        const pageML = parseFloat(String(style.mL || 0.5)) || 0.5;
        indentInches = Math.max(0, Math.round((rulerPos - pageML) * 16) / 16);
      }

      // Real-time font size detection at cursor:
      let detectedFontSize = style.fontSize || 10.5;
      if (sel.anchorNode) {
        let elNode: HTMLElement | null = null;
        if (sel.anchorNode.nodeType === Node.ELEMENT_NODE) {
          elNode = sel.anchorNode as HTMLElement;
        } else {
          elNode = sel.anchorNode.parentElement;
        }
        if (elNode) {
          const compStyle = window.getComputedStyle(elNode);
          const pxSize = parseFloat(compStyle.fontSize);
          if (pxSize > 0) {
            // 1pt = 1.333px in 96 DPI CSS
            const ptSize = Math.round((pxSize * 0.75) * 10) / 10;
            detectedFontSize = ptSize;
          }
        }
      }

      window.dispatchEvent(
        new CustomEvent('active-line-indent-detected', {
          detail: { indentInches, rulerPosInches: rulerPos, pageIndex },
        })
      );
      window.dispatchEvent(
        new CustomEvent('active-cursor-font-detected', {
          detail: { fontSize: detectedFontSize, pageIndex },
        })
      );
    } catch (err) {
      console.warn('Error detecting line indent:', err);
    }
  }, [style.zoom, style.mL, pageIndex]);

  useEffect(() => {
    const handleSelChange = () => {
      const el = ref.current;
      if (el && (document.activeElement === el || el.contains(document.activeElement))) {
        updateActiveLineIndent();
      }
    };
    document.addEventListener('selectionchange', handleSelChange);
    return () => document.removeEventListener('selectionchange', handleSelChange);
  }, [updateActiveLineIndent]);

  useEffect(() => {
    const handleApplyIndent = (e: any) => {
      const el = ref.current;
      if (!el || !(document.activeElement === el || el.contains(document.activeElement))) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      let node: Node | null = sel.anchorNode;
      let blockNode: HTMLElement | null = null;
      while (node && node !== el) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const h = node as HTMLElement;
          if (/^(P|H[1-6]|DIV|LI|BLOCKQUOTE)$/.test(h.tagName)) {
            blockNode = h;
            break;
          }
        }
        node = node.parentNode;
      }
      if (blockNode && e.detail && typeof e.detail.indentInches === 'number') {
        blockNode.style.marginLeft = `${e.detail.indentInches}in`;
        checkAndReflow(true);
        if (onSyncPageContent) onSyncPageContent(pageIndex, el.innerHTML);
      }
    };
    window.addEventListener('apply-line-indent', handleApplyIndent);
    return () => window.removeEventListener('apply-line-indent', handleApplyIndent);
  }, [checkAndReflow, onSyncPageContent, pageIndex]);

  // Table Drag & Drop across any page
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      const container = target?.closest('.custom-table-container') as HTMLElement | null;
      if (container) {
        (window as any).__draggedTable = container;
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', 'custom-table');
          e.dataTransfer.effectAllowed = 'move';
        }
        container.style.opacity = '0.4';
      }
    };

    const handleDragEnd = (e: DragEvent) => {
      const container = (window as any).__draggedTable as HTMLElement | null;
      if (container) {
        container.style.opacity = '1';
        (window as any).__draggedTable = null;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if ((window as any).__draggedTable) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      }
    };

    const handleDrop = (e: DragEvent) => {
      const dragged = (window as any).__draggedTable as HTMLElement | null;
      if (!dragged) return;
      e.preventDefault();
      dragged.style.opacity = '1';

      const targetArea = el;
      const sourceArea = dragged.closest('.content-area') as HTMLElement | null;

      // Find drop location within targetArea
      let dropNode: Node | null = null;
      if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) dropNode = range.startContainer;
      } else if ((document as any).caretPositionFromPoint) {
        const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) dropNode = pos.offsetNode;
      }

      if (!dropNode && targetArea.contains(e.target as Node)) {
        dropNode = e.target as Node;
      }

      let blockNode: Node | null = dropNode;
      while (blockNode && blockNode.parentNode !== targetArea) {
        blockNode = blockNode.parentNode;
      }

      if (blockNode === dragged) return;

      if (blockNode && blockNode.parentNode === targetArea) {
        targetArea.insertBefore(dragged, blockNode);
      } else {
        targetArea.appendChild(dragged);
      }

      (window as any).__draggedTable = null;

      if (sourceArea) sourceArea.dispatchEvent(new Event('input', { bubbles: true }));
      if (targetArea !== sourceArea) targetArea.dispatchEvent(new Event('input', { bubbles: true }));
    };

    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('drop', handleDrop);

    return () => {
      el.removeEventListener('dragstart', handleDragStart);
      el.removeEventListener('dragend', handleDragEnd);
      el.removeEventListener('dragover', handleDragOver);
      el.removeEventListener('drop', handleDrop);
    };
  }, []);

  const moveParagraph = useCallback((fromIdx: number, direction: 'up' | 'down') => {
    const el = ref.current;
    if (!el) return;
    const children = Array.from(el.children);
    if (direction === 'up' && fromIdx > 0) {
      el.insertBefore(children[fromIdx], children[fromIdx - 1]);
    } else if (direction === 'down' && fromIdx < children.length - 1) {
      el.insertBefore(children[fromIdx + 1], children[fromIdx]);
    }
    setTimeout(() => checkAndReflow(true), 50);
  }, [checkAndReflow]);

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden group/ca">
      <div
        ref={ref}
        contentEditable={true}
        suppressContentEditableWarning={true}
        onFocus={() => {
          try {
            document.execCommand('defaultParagraphSeparator', false, 'p');
          } catch {}
          onFocus();
          updateActiveLineIndent();
        }}
        onClick={() => {
          onClick();
          updateActiveLineIndent();
        }}
        onMouseUp={updateActiveLineIndent}
        onKeyUp={updateActiveLineIndent}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onCut={() => {
          setTimeout(() => {
            checkAndReflow(true);
            if (onSyncPageContent && ref.current) {
              onSyncPageContent(pageIndex, ref.current.innerHTML);
            }
          }, 60);
        }}
        onPaste={handlePaste}
        onBlur={(e) => {
          const val = e.currentTarget.innerHTML;
          onBlur(val);
        }}
        className={cn(
          "content-area w-full h-full font-kalpurush outline-none overflow-hidden",
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
      {/* লাইন/অনুচ্ছেদ সরানোর হ্যান্ডেল — শুধু সক্রিয় পাতায় দেখা যাবে */}
      {isActive && (
        <ParagraphMoveHandles contentRef={ref} onMoveParagraph={moveParagraph} />
      )}
    </div>
  );
}



export interface QuestionPrintViewProps {
  meta: any;
  questions: any[];
  questionsB?: any[];
  appName?: string;
  softwareConfig?: any;
  onSave: (updatedContent: string, styles: any) => Promise<void>;
  onBack: () => void;
}

export function QuestionPrintView({
  meta,
  questions,
  questionsB = [],
  appName = 'টপ গ্রেড টিউটোরিয়ালস',
  softwareConfig,
  onSave,
  onBack,
}: QuestionPrintViewProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const measurementRef = useRef<HTMLDivElement>(null);
  const hasInitiallyPaginatedRef = useRef(false);

  const isEnglish = meta.subject?.toLowerCase().includes('english') || meta.subject?.toLowerCase().includes('ইংরেজি');

  // Convert questions array to HTML string
  const initialContent = useMemo(() => {
    if (meta.content && meta.content.trim()) {
      return meta.content;
    }
    const parts: string[] = [];
    questions.forEach((q, idx) => {
      parts.push(formatQuestionToBoardStandardHtml(q.content || '', idx, Boolean(isEnglish), q.type));
    });
    if (questionsB && questionsB.length > 0) {
      parts.push(`<div class="set-b-header" style="page-break-before: always; margin-top: 24px; border-top: 2px dashed #000; padding-top: 12px; text-align: center; font-weight: bold; font-size: 13pt;">--- সেট: খ (B) ---</div>`);
      questionsB.forEach((q, idx) => {
        parts.push(formatQuestionToBoardStandardHtml(q.content || '', idx, Boolean(isEnglish), q.type));
      });
    }
    return parts.join('\n\n');
  }, [questions, questionsB, isEnglish, meta.content]);

  const [documentContent, setDocumentContent] = useState(initialContent);

  // Print layout settings & states
  const [paginatedPages, setPaginatedPages] = useState<string[]>([]);
  const [manualPages, setManualPages] = useState<Record<number, string>>({});
  const [pageStyles, setPageStyles] = useState<Record<number, any>>({
    0: {
      fontSize: 10.5,
      lineHeight: 1.2,
      bold: false,
      italic: false,
      underline: false,
      color: '#000000',
      align: 'justify',
      mT: 0.5,
      mB: 0.5,
      mL: 0.5,
      mR: 0.5,
      columns: 1,
      columnRule: false,
      orientation: 'portrait',
      border: 'none',
    }
  });

  const [repaginateVersion, setRepaginateVersion] = useState(0);
  const [activeEditIdx, setActiveEditIdx] = useState<number | null>(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'home' | 'layout' | 'insert' | 'watermark'>('layout');
  const [previewZoom, setPreviewZoom] = useState(100);
  const effectiveZoom = Math.round(Math.max(50, Math.min(200, Number(previewZoom) || 100)));
  const [showRuler, setShowRuler] = useState(true);
  const [tabStops, setTabStops] = useState<number[]>([]);
  const [applyScope, setApplyScope] = useState<'single' | 'all'>('single');
  const [activeLineIndent, setActiveLineIndent] = useState<number>(0);
  const [activeRulerPos, setActiveRulerPos] = useState<number | undefined>(undefined);

  const [globalFontSize, setGlobalFontSize] = useState(10.5);
  const [globalLineHeight, setGlobalLineHeight] = useState(1.2);
  const [fontSizeDraft, setFontSizeDraft] = useState("");

  const [printSettings, setPrintSettings] = useState<any>({
    marginTop: 0.5,
    marginBottom: 0.5,
    marginLeft: 0.5,
    marginRight: 0.5,
    watermarkText: '',
    watermarkOpacity: 15,
    watermarkRotation: -30,
    watermarkType: 'text',
    watermarkImageSize: 60,
  });

  // AI Modal in Print View
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiType, setAiType] = useState<'creative' | 'short' | 'mcq' | 'mixed'>('creative');
  const [aiCount, setAiCount] = useState<number>(3);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [aiTopic, setAiTopic] = useState(meta.chapter || '');

  // Safeguard against browser / extension runaway zoom (e.g. 9960% or 10000%)
  useEffect(() => {
    const handleWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setPreviewZoom(prev => {
          const delta = e.deltaY < 0 ? 5 : -5;
          return Math.max(50, Math.min(200, Math.round((Number(prev) || 100) + delta)));
        });
      }
    };
    window.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => window.removeEventListener('wheel', handleWheelZoom);
  }, []);

  useEffect(() => {
    const handleIndentDetected = (e: any) => {
      if (e.detail) {
        if (typeof e.detail.indentInches === 'number') {
          setActiveLineIndent(e.detail.indentInches);
        }
        if (typeof e.detail.rulerPosInches === 'number') {
          setActiveRulerPos(e.detail.rulerPosInches);
        }
      }
    };
    window.addEventListener('active-line-indent-detected', handleIndentDetected);
    return () => window.removeEventListener('active-line-indent-detected', handleIndentDetected);
  }, []);

  const updatePageStyle = useCallback((idx: number, key: string, val: any) => { 
    setPageStyles(prev => {
      const current = prev[idx] || { fontSize: globalFontSize, lineHeight: globalLineHeight, bold: false, italic: false, underline: false, color: '#000000', align: 'justify', mT: 0.5, mB: 0.5, mL: 0.5, mR: 0.5, columns: 1, columnRule: false, orientation: 'portrait', border: 'none' };
      return { ...prev, [idx]: { ...current, [key]: val } };
    }); 
  }, [globalFontSize, globalLineHeight]);

  const repaginateDocument = useCallback((opts?: {
    newFontSize?: number;
    newLineHeight?: number;
    newCols?: number;
    newColumnRule?: boolean;
    newOrientation?: string;
    newMargin?: number;
    sourceContent?: string;
  }) => {
    if (!measurementRef.current) return;

    const currentFontSize = opts?.newFontSize ?? globalFontSize;
    const currentLineHeight = opts?.newLineHeight ?? globalLineHeight;
    const firstStyle = pageStyles[0] || pageStyles[activeEditIdx !== null ? activeEditIdx : 0] || {};
    const currentCols = opts?.newCols ?? firstStyle.columns ?? 1;
    const currentOrientation = opts?.newOrientation ?? firstStyle.orientation ?? 'portrait';
    const isLandscape = currentOrientation === 'landscape';

    const baseWidth = isLandscape ? 11.69 : 8.27;
    const baseHeight = isLandscape ? 8.27 : 11.69;

    const marginT = opts?.newMargin ?? (parseFloat(String(firstStyle.mT)) || 0.5);
    const marginB = opts?.newMargin ?? (parseFloat(String(firstStyle.mB)) || 0.5);
    const marginL = opts?.newMargin ?? (parseFloat(String(firstStyle.mL)) || 0.5);
    const marginR = opts?.newMargin ?? (parseFloat(String(firstStyle.mR)) || 0.5);

    const totalContentWidthInches = Math.max(2, baseWidth - marginL - marginR);
    const colGapInches = 0.35;
    const colWidthInches = currentCols > 1
      ? Math.max(1, (totalContentWidthInches - (currentCols - 1) * colGapInches) / currentCols)
      : totalContentWidthInches;

    const container = measurementRef.current;
    container.style.width = colWidthInches + 'in';
    container.style.fontSize = currentFontSize + 'pt';
    container.style.lineHeight = String(currentLineHeight);

    let sourceText = opts?.sourceContent;
    if (!sourceText) {
      // 1. First priority: Capture directly from live DOM of all .content-area elements
      const contentAreas = typeof document !== 'undefined' ? document.querySelectorAll('.content-area') : null;
      if (contentAreas && contentAreas.length > 0) {
        const liveTexts: string[] = [];
        contentAreas.forEach(ca => {
          const html = ca.innerHTML.trim();
          if (html) liveTexts.push(html);
        });
        if (liveTexts.length > 0) {
          sourceText = liveTexts.join('\n\n');
        }
      }

      // 2. Second priority: manualPages state if DOM was not present or empty
      if (!sourceText) {
        const manualKeys = Object.keys(manualPages).map(Number).filter(k => manualPages[k] && manualPages[k].trim());
        if (manualKeys.length > 0) {
          manualKeys.sort((a, b) => a - b);
          sourceText = manualKeys.map(k => manualPages[k] || '').filter(Boolean).join('\n\n');
        } else if (documentContent && documentContent.trim()) {
          sourceText = documentContent;
        } else {
          sourceText = initialContent;
        }
      }
    }

    if (!sourceText || !sourceText.trim()) return;

    const rawFormatted = formatMath(sourceText);

    // Extract blocks cleanly
    const blocks: string[] = [];
    const parserDiv = document.createElement('div');
    parserDiv.innerHTML = rawFormatted;

    const extractBlocks = (parent: HTMLElement) => {
      Array.from(parent.childNodes).forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toUpperCase();
          if (el.classList.contains('cq-item') || el.classList.contains('mcq-item') || el.classList.contains('short-item') || el.classList.contains('custom-table-container')) {
            blocks.push(el.outerHTML);
          } else if (/^(P|H[1-6]|TABLE|BLOCKQUOTE|UL|OL|LI|DIV|HR|SECTION|ARTICLE)$/.test(tag)) {
            if (el.querySelector('.cq-item, .mcq-item, .short-item, .custom-table-container')) {
              extractBlocks(el);
            } else {
              blocks.push(el.outerHTML);
            }
          } else {
            extractBlocks(el);
          }
        } else if (node.textContent && node.textContent.trim()) {
          blocks.push(`<p style="margin: 0 0 4px 0;">${node.textContent.trim()}</p>`);
        }
      });
    };
    extractBlocks(parserDiv);

    const finalBlocks = blocks.length > 0
      ? blocks
      : rawFormatted.split(/\r?\n/).filter(l => l.trim() !== '').map(l => `<p style="margin: 0 0 4px 0;">${l}</p>`);

    container.innerHTML = finalBlocks.map((b, i) => `<div class="measure-block" data-idx="${i}" style="margin: 0 0 4px 0;">${b}</div>`).join('');

    const totalPageHeightPx = baseHeight * 96;

    const getBaseColH = (pIdx: number) => {
      // Header: Page 0 has full institutional header (~145px); subsequent pages have compact header (~28px)
      const pageHeaderH = (pIdx === 0) ? 145 : 28;
      const pageFooterH = 35;
      const availableH = totalPageHeightPx - (marginT * 96) - (marginB * 96) - pageHeaderH - pageFooterH;
      // Safety margin of 14px so questions at the bottom of a column never overflow into an invisible extra column
      return Math.max(150, availableH - 14);
    };

    const measureLines = container.querySelectorAll('.measure-block');
    const newPages: string[] = [];
    let currentPageBlocks: string[] = [];
    let pageIndex = 0;
    let currentColIdx = 0; // 0 to (currentCols - 1)
    let currentColH = 0;

    measureLines.forEach((line, idx) => {
      const h = (line as HTMLElement).offsetHeight || 24;
      const maxColH = getBaseColH(pageIndex);

      if (currentColH > 0 && currentColH + h > maxColH) {
        // Does not fit in current column!
        if (currentColIdx + 1 < currentCols) {
          // Advance to next column on the same page
          currentColIdx++;
          currentColH = h;
          currentPageBlocks.push(finalBlocks[idx]);
        } else {
          // All columns on this page are filled! Push current page and advance to next page
          newPages.push(currentPageBlocks.join(''));
          pageIndex++;
          currentPageBlocks = [finalBlocks[idx]];
          currentColIdx = 0;
          currentColH = h;
        }
      } else {
        // Fits in current column
        currentPageBlocks.push(finalBlocks[idx]);
        currentColH += h;
      }
    });

    if (currentPageBlocks.length > 0) {
      newPages.push(currentPageBlocks.join(''));
    }

    const pagesToRender = newPages.length > 0 ? newPages : [""];
    setPaginatedPages(pagesToRender);

    const initialStyles: Record<number, any> = {};
    const initialManual: Record<number, string> = {};
    pagesToRender.forEach((p, i) => {
      initialStyles[i] = {
        ...(pageStyles[i] || pageStyles[0] || {}),
        fontSize: currentFontSize,
        lineHeight: currentLineHeight,
        columns: currentCols,
        columnRule: opts?.newColumnRule !== undefined ? opts.newColumnRule : Boolean(pageStyles[i]?.columnRule ?? pageStyles[0]?.columnRule ?? false),
        orientation: currentOrientation,
        mT: marginT,
        mB: marginB,
        mL: marginL,
        mR: marginR,
      };
      initialManual[i] = p;
    });

    setPageStyles(initialStyles);
    setManualPages(initialManual);
    setDocumentContent(sourceText);
    setRepaginateVersion(v => v + 1);
  }, [globalFontSize, globalLineHeight, pageStyles, activeEditIdx, documentContent, initialContent, manualPages]);

  // Initial pagination
  useEffect(() => {
    if (!measurementRef.current || hasInitiallyPaginatedRef.current) return;
    hasInitiallyPaginatedRef.current = true;
    repaginateDocument({ sourceContent: initialContent });
  }, [repaginateDocument, initialContent]);

  const handleGlobalFontSizeChange = (sizeStr: string) => {
    const size = parseFloat(sizeStr);
    if (isNaN(size) || size < 6 || size > 72) return;
    setGlobalFontSize(size);
    setFontSizeDraft(sizeStr);
    repaginateDocument({ newFontSize: size });
  };

  const handleAddNextPage = (initialContent = "") => {
    setPaginatedPages(prev => [...prev, initialContent]);
    const nextIdx = paginatedPages.length;
    setManualPages(prev => ({ ...prev, [nextIdx]: initialContent }));
    const baseStyle = pageStyles[0] || {};
    setPageStyles(prev => ({ ...prev, [nextIdx]: { ...baseStyle } }));
    setActiveEditIdx(nextIdx);
  };

  const handleRemoveEmptyPage = (pageIndex: number) => {
    if (pageIndex === 0) return;
    setPaginatedPages(prev => prev.filter((_, i) => i !== pageIndex));
    setManualPages(prev => {
      const next = { ...prev };
      delete next[pageIndex];
      return next;
    });
    setActiveEditIdx(Math.max(0, pageIndex - 1));
  };

  const handleFocusPage = (pageIndex: number, position: 'start' | 'end') => {
    setActiveEditIdx(pageIndex);
    setTimeout(() => {
      const targetArea = document.querySelector(`.paper-idx-${pageIndex} .content-area`) as HTMLElement | null;
      if (!targetArea) return;
      targetArea.focus();
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      range.selectNodeContents(targetArea);
      range.collapse(position === 'start');
      sel.removeAllRanges();
      sel.addRange(range);
    }, 40);
  };

  const handleSyncPageContent = (pageIndex: number, content: string) => {
    setManualPages(prev => {
      const updated = { ...prev, [pageIndex]: content };
      const sortedKeys = Object.keys(updated).map(Number).sort((a, b) => a - b);
      const full = sortedKeys.map(k => updated[k] || '').filter(Boolean).join('\n\n');
      setDocumentContent(full);
      return updated;
    });
  };

  const handleSaveDocument = async () => {
    setSaving(true);
    try {
      const contentAreas = typeof document !== 'undefined' ? document.querySelectorAll('.content-area') : null;
      let fullText = '';
      if (contentAreas && contentAreas.length > 0) {
        const liveTexts: string[] = [];
        contentAreas.forEach(ca => {
          const html = ca.innerHTML.trim();
          if (html) liveTexts.push(html);
        });
        if (liveTexts.length > 0) {
          fullText = liveTexts.join('\n\n');
        }
      }
      if (!fullText) {
        const sortedKeys = Object.keys(manualPages).map(Number).sort((a, b) => a - b);
        fullText = sortedKeys.map(k => manualPages[k] || '').filter(Boolean).join('\n\n');
      }
      await onSave(fullText, pageStyles);
      toast({ title: 'সফল!', description: 'প্রশ্নপত্র সফলভাবে সেভ করা হয়েছে।' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: err.message || 'সেভ করা সম্ভব হয়নি।' });
    } finally {
      setSaving(false);
    }
  };

  const handleAiGenerateQuestions = async () => {
    if (!meta.classId || !meta.subject) {
      toast({ variant: 'destructive', title: 'তথ্য দিন', description: 'শ্রেণি ও বিষয় নির্বাচন করুন।' });
      return;
    }
    setAiGenerating(true);
    try {
      const res = await generatePracticeQuestions({
        classId: meta.classId,
        subject: meta.subject,
        chapter: aiTopic || meta.chapter || 'গুরুত্বপূর্ণ অধ্যায়সমূহ',
        type: aiType,
        count: aiCount,
        institutionName: meta.institution || appName,
      });

      if (!res.questions || res.questions.length === 0) {
        throw new Error('কোনো প্রশ্ন জেনারেট হয়নি।');
      }

      const newHtmlBlocks = res.questions.map((q, i) => {
        const nextNum = questions.length + i + 1;
        const num = isEnglish ? `${nextNum}.` : `${toBengaliNumber(nextNum)}।`;
        return `<div class="question-block my-2" style="margin: 10px 0;"><p style="margin: 0 0 4px 0; font-weight: bold;"><span style="display: inline-block; min-width: 24px;">${num}</span> ${q.formattedText}</p></div>`;
      }).join('\n\n');

      const updated = documentContent ? (documentContent + '\n\n' + newHtmlBlocks) : newHtmlBlocks;
      setDocumentContent(updated);
      repaginateDocument({ sourceContent: updated });
      setAiModalOpen(false);
      toast({ title: 'প্রশ্ন তৈরি সম্পন্ন!', description: `মোট ${res.questions.length}টি প্রশ্ন ডকুমেন্টে যুক্ত হয়েছে।` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: err.message || 'AI প্রশ্ন তৈরি ব্যর্থ হয়েছে।' });
    } finally {
      setAiGenerating(false);
    }
  };

  const currentPaperStyle = pageStyles[activeEditIdx !== null ? activeEditIdx : 0] || pageStyles[0] || {};
  const currentCols = currentPaperStyle.columns || 1;
  const currentColumnRule = Boolean(currentPaperStyle.columnRule);
  const currentOrientation = currentPaperStyle.orientation || 'portrait';
  const currentPageSize = currentPaperStyle.pageSize || 'a4';
  const currentPageBorder = currentPaperStyle.border || 'none';
  const currentMarginL = currentPaperStyle.mL !== undefined ? currentPaperStyle.mL : (parseFloat(String(printSettings.marginLeft)) || 0.5);
  const currentMarginR = currentPaperStyle.mR !== undefined ? currentPaperStyle.mR : (parseFloat(String(printSettings.marginRight)) || 0.5);
  const currentBaseWidth = currentPageSize === 'letter' ? 8.5 : currentPageSize === 'legal' ? 8.5 : 8.27;
  const currentBaseHeight = currentPageSize === 'letter' ? 11.0 : currentPageSize === 'legal' ? 14.0 : 11.69;
  const currentPaperWidth = currentOrientation === 'landscape' ? currentBaseHeight : currentBaseWidth;

  return (
    <div className="print-view-container flex flex-col h-screen fixed inset-0 top-0 left-0 bg-slate-100 z-[40] font-kalpurush overflow-hidden select-none">
      {/* Invisible measurement container */}
      <div ref={measurementRef} style={{ position: 'absolute', top: -99999, left: -99999, visibility: 'hidden', pointerEvents: 'none' }} />

      {/* ── Top Header Toolbar ── */}
      <header className="no-print h-12 bg-white border-b flex items-center justify-between px-4 shrink-0 shadow-sm z-50 select-none">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(prev => !prev)}
            className="h-8 w-8 text-slate-600 hover:text-slate-900"
            title={sidebarOpen ? "সাইড মেনুবার লুকান" : "সাইড মেনুবার দেখান"}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </Button>
          <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center">
            <Eye className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm hidden sm:inline text-slate-800 truncate max-w-xs md:max-w-md">
            প্রিন্ট প্রিভিউ ও এডিটর - {meta.institution || appName}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Font Size +/- */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 gap-0.5" title="ফন্ট সাইজ পরিবর্তন করুন">
            <button
              type="button"
              onClick={() => {
                const newSize = Math.max(6, (parseFloat(fontSizeDraft) || globalFontSize) - 0.5);
                setFontSizeDraft(String(newSize));
                handleGlobalFontSizeChange(String(newSize));
              }}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors font-bold text-xs"
              title="ফন্ট ছোট করুন"
            >−</button>
            <input
              type="number"
              min={6} max={72} step={0.5}
              value={fontSizeDraft || globalFontSize}
              onChange={e => setFontSizeDraft(e.target.value)}
              onBlur={e => { if (e.target.value) handleGlobalFontSizeChange(e.target.value); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                  handleGlobalFontSizeChange((e.target as HTMLInputElement).value);
                }
              }}
              className="w-11 text-center text-[11px] font-bold bg-transparent border-none outline-none text-slate-800 no-arrows"
              title="ফন্ট সাইজ লিখুন (pt)"
            />
            <span className="text-[9px] text-slate-500 font-bold pr-0.5">pt</span>
            <button
              type="button"
              onClick={() => {
                const newSize = Math.min(72, (parseFloat(fontSizeDraft) || globalFontSize) + 0.5);
                setFontSizeDraft(String(newSize));
                handleGlobalFontSizeChange(String(newSize));
              }}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors font-bold text-xs"
              title="ফন্ট বড় করুন"
            >+</button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setPreviewZoom(Math.max(50, effectiveZoom - 10))}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors"
              title="জুম কমান"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom(100)}
              className="text-[11px] font-bold px-1.5 min-w-[50px] text-center text-slate-700 hover:text-indigo-600 cursor-pointer transition-colors"
              title="ক্লিক করে ১০০% রিসেট করুন"
            >
              {toBengaliNumber(effectiveZoom)}%
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom(Math.min(200, effectiveZoom + 10))}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors"
              title="জুম বাড়ান"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Ruler Toggle */}
          <Button
            variant={showRuler ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowRuler(prev => !prev)}
            className={cn("h-8 text-xs font-bold gap-1 px-2.5", showRuler && "bg-indigo-100 text-indigo-700")}
            title="রুলার দেখান / লুকান"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className="hidden md:inline">রুলার</span>
          </Button>

          {/* AI Question Assistant Button */}
          <Button
            size="sm"
            onClick={() => setAiModalOpen(true)}
            className="h-8 gap-1.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span className="hidden sm:inline">AI সহকারী</span>
          </Button>

          {/* Page Count */}
          <div className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 hidden md:block">
            মোট পাতা: {toBengaliNumber(paginatedPages.length)}
          </div>

          {/* Back, Save, Print */}
          <Button variant="outline" size="sm" onClick={onBack} className="h-8 gap-1.5 font-bold border-slate-300 text-slate-700 bg-white">
            <ArrowLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">ফিরে যান</span>
          </Button>
          <Button size="sm" onClick={handleSaveDocument} disabled={saving} className="h-8 gap-1.5 font-bold bg-green-600 hover:bg-green-700 text-white px-3">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} সেভ
          </Button>
          <Button size="sm" onClick={() => window.print()} className="h-8 gap-1.5 font-bold bg-primary hover:bg-primary/90 text-white px-4">
            <Printer className="w-3.5 h-3.5" /> প্রিন্ট
          </Button>
        </div>
      </header>

      {/* Main Print Body */}
      <div className="print-body-row flex-1 flex overflow-hidden">
        {/* ── Left Sidebar Menubar ── */}
        <aside
          className={cn(
            "no-print bg-white border-r flex flex-col shrink-0 transition-all duration-300 z-30 font-kalpurush select-none",
            sidebarOpen ? "w-80 lg:w-88" : "w-0 overflow-hidden border-none"
          )}
        >
          {/* Tab buttons */}
          <div className="grid grid-cols-4 border-b bg-slate-50 text-xs font-black p-1 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarTab('home')}
              className={cn("py-1.5 px-1 rounded-lg text-center transition-all", sidebarTab === 'home' ? "bg-white text-indigo-600 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-800")}
            >হোম</button>
            <button
              type="button"
              onClick={() => setSidebarTab('layout')}
              className={cn("py-1.5 px-1 rounded-lg text-center transition-all", sidebarTab === 'layout' ? "bg-white text-indigo-600 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-800")}
            >লেআউট</button>
            <button
              type="button"
              onClick={() => setSidebarTab('insert')}
              className={cn("py-1.5 px-1 rounded-lg text-center transition-all", sidebarTab === 'insert' ? "bg-white text-indigo-600 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-800")}
            >ইনসার্ট</button>
            <button
              type="button"
              onClick={() => setSidebarTab('watermark')}
              className={cn("py-1.5 px-1 rounded-lg text-center transition-all", sidebarTab === 'watermark' ? "bg-white text-indigo-600 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-800")}
            >জলছাপ</button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <WordToolbar
              mode="sidebar"
              externalTab={sidebarTab === 'watermark' ? 'home' : (sidebarTab as 'home' | 'insert' | 'layout')}
              onExternalTabChange={(tab) => setSidebarTab(tab)}
              activePageIndex={activeEditIdx}
              totalPages={paginatedPages.length}
              zoomLevel={previewZoom}
              onZoomChange={setPreviewZoom}
              currentColumns={currentCols}
              currentColumnRule={currentColumnRule}
              onColumnsChange={(cols, hasRule) => {
                const finalRule = Boolean(hasRule);
                if (applyScope === 'all') {
                  paginatedPages.forEach((_, i) => {
                    updatePageStyle(i, 'columns', cols);
                    updatePageStyle(i, 'columnRule', cols > 1 ? finalRule : false);
                  });
                } else {
                  const targetIdx = activeEditIdx !== null ? activeEditIdx : 0;
                  updatePageStyle(targetIdx, 'columns', cols);
                  updatePageStyle(targetIdx, 'columnRule', cols > 1 ? finalRule : false);
                }
                if (cols !== currentCols) {
                  repaginateDocument({ newCols: cols, newColumnRule: finalRule });
                }
              }}
              currentOrientation={currentOrientation}
              onOrientationChange={(orient) => {
                repaginateDocument({ newOrientation: orient });
              }}
              onMarginPresetChange={(preset) => {
                const mVal = preset === 'narrow' ? 0.25 : preset === 'wide' ? 1.0 : 0.5;
                setPrintSettings((p: any) => ({ ...p, marginTop: mVal, marginBottom: mVal, marginLeft: mVal, marginRight: mVal }));
                repaginateDocument({ newMargin: mVal });
              }}
              currentPageBorder={currentPageBorder}
              onPageBorderChange={(border) => {
                if (applyScope === 'all') {
                  paginatedPages.forEach((_, i) => { updatePageStyle(i, 'border', border); });
                } else if (activeEditIdx !== null) {
                  updatePageStyle(activeEditIdx, 'border', border);
                }
              }}
              showRuler={showRuler}
              onToggleRuler={() => setShowRuler(prev => !prev)}
              currentPageSize={currentPageSize}
              onPageSizeChange={(size) => {
                if (applyScope === 'all') {
                  paginatedPages.forEach((_, i) => { updatePageStyle(i, 'pageSize', size); });
                } else if (activeEditIdx !== null) {
                  updatePageStyle(activeEditIdx, 'pageSize', size);
                }
              }}
              currentFontSize={globalFontSize}
              onFontSizeChange={(size) => handleGlobalFontSizeChange(String(size))}

            />
          </div>
        </aside>

        {/* ── Main Canvas Area with Dynamic Pages ── */}
        <div className="print-canvas-col flex-1 flex flex-col overflow-hidden relative">
          <main className="print-main-area flex-1 overflow-y-auto bg-slate-200 py-6 flex flex-col items-center gap-8 relative" style={{ zoom: effectiveZoom !== 100 ? `${effectiveZoom}%` : undefined }}>
            {showRuler && (
              <div className="no-print sticky top-0 z-40 bg-slate-200/95 backdrop-blur-xs pb-3 pt-1 flex justify-center w-full shadow-xs">
                <WordRuler
                  paperWidthInches={currentPaperWidth}
                  marginLeft={currentMarginL}
                  marginRight={currentMarginR}
                  zoomLevel={effectiveZoom}
                  onMarginChange={(left, right) => {
                    if (applyScope === 'all') {
                      paginatedPages.forEach((_, i) => {
                        updatePageStyle(i, 'mL', left);
                        updatePageStyle(i, 'mR', right);
                      });
                    } else {
                      const targetIdx = activeEditIdx ?? 0;
                      updatePageStyle(targetIdx, 'mL', left);
                      updatePageStyle(targetIdx, 'mR', right);
                    }
                    setPrintSettings((prev: any) => ({ ...prev, marginLeft: left, marginRight: right }));
                    repaginateDocument({ newMargin: left });
                  }}
                  tabStops={tabStops}
                  onTabStopsChange={setTabStops}
                  activeLineIndent={activeLineIndent}
                  activeRulerPos={activeRulerPos}
                  onLineIndentChange={(newIndent) => {
                    setActiveLineIndent(newIndent);
                    window.dispatchEvent(
                      new CustomEvent('apply-line-indent', {
                        detail: { indentInches: newIndent }
                      })
                    );
                  }}
                />
              </div>
            )}
            {paginatedPages.map((pageHtml, idx) => {
              const style = pageStyles[idx] || pageStyles[0] || {};
              const marginT = style.mT !== undefined ? style.mT : (parseFloat(String(printSettings.marginTop)) || 0.5);
              const marginB = style.mB !== undefined ? style.mB : (parseFloat(String(printSettings.marginBottom)) || 0.5);
              const marginL = style.mL !== undefined ? style.mL : (parseFloat(String(printSettings.marginLeft)) || 0.5);
              const marginR = style.mR !== undefined ? style.mR : (parseFloat(String(printSettings.marginRight)) || 0.5);
              const isLandscape = style.orientation === 'landscape';
              const pSize = style.pageSize || 'a4';
              const baseWidth = pSize === 'letter' ? 8.5 : pSize === 'legal' ? 8.5 : 8.27;
              const baseHeight = pSize === 'letter' ? 11.0 : pSize === 'legal' ? 14.0 : 11.69;
              const pWidth = isLandscape ? `${baseHeight}in` : `${baseWidth}in`;
              const pHeight = isLandscape ? `${baseWidth}in` : `${baseHeight}in`;
              const borderCss = style.border === 'thin' ? '1.5px solid #000' :
                                style.border === 'double' ? '3.5px double #000' :
                                style.border === 'box' ? '2.5px solid #1e293b' : undefined;
              const cols = style.columns || 1;
              const hasRule = Boolean(style.columnRule);

              return (
                <div
                  key={`paper-${idx}-v${repaginateVersion}`}
                  className={cn(
                    `paper paper-idx-${idx} shadow-2xl bg-white relative overflow-hidden shrink-0 group transition-all`,
                    activeEditIdx === idx && "ring-4 ring-blue-500 shadow-blue-200"
                  )}
                  style={{
                    width: pWidth,
                    height: pHeight,
                    padding: `${marginT}in ${marginR}in ${marginB}in ${marginL}in`,
                    lineHeight: '1.2',
                    boxSizing: 'border-box',
                    border: borderCss
                  }}
                >
                  {/* Action buttons on hover */}
                  <div className="no-print absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 flex gap-2">
                    <Button size="sm" variant={activeEditIdx === idx ? 'default' : 'secondary'} className="gap-2 font-bold shadow-lg" onClick={() => setActiveEditIdx(idx)}>
                      <Edit3 className="w-3.5 h-3.5" /> এডিট করুন
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-2 font-bold shadow-lg" onClick={() => {
                      if (!confirm("মুছে ফেলবেন?")) return;
                      const newP = paginatedPages.filter((_, i) => i !== idx);
                      setPaginatedPages(newP);
                    }}>
                      <Trash2 className="w-3.5 h-3.5" /> মুছে ফেলুন
                    </Button>
                  </div>

                  {/* Watermark */}
                  {printSettings.watermarkText && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden" style={{ opacity: (printSettings.watermarkOpacity || 15) / 100, transform: `rotate(${printSettings.watermarkRotation || -30}deg)`, whiteSpace: 'nowrap' }}>
                      <span className="font-black text-black" style={{ fontSize: '48pt' }}>{printSettings.watermarkText}</span>
                    </div>
                  )}

                  {/* Paper Content */}
                  <div className="relative z-10 flex flex-col h-full text-black">
                    {/* Header */}
                    {idx === 0 ? (
                      <header className="paper-institutional-header text-center border-b-2 border-black pb-1 mb-2">
                        <h1 className="font-black text-[22px] text-black leading-tight uppercase">
                          {meta.institution || appName}
                        </h1>
                        <h2 className="text-[13pt] font-bold text-black mt-1 underline">
                          {meta.exam}
                        </h2>
                        <div className="flex justify-center items-center gap-6 sm:gap-8 text-[10.5pt] font-bold mt-2 px-2">
                          <span>শ্রেণি: {CLASSES.find(c => c.id === meta.classId)?.label || ''}</span>
                          {questionsB.length > 0 && <span className="text-[11pt] font-black border border-black px-2 py-0.5">সেট: ক (A)</span>}
                          <span>বিষয়: {meta.subject} {meta.chapter && `(${meta.chapter})`}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9.5pt] font-bold mt-1 px-2 italic border-t pt-0.5 border-dashed border-slate-300">
                          <span>সময়: {meta.time}</span>
                          <span>পূর্ণমান: {toBengaliNumber(meta.totalMarks)}</span>
                        </div>
                      </header>
                    ) : (
                      <div className="flex justify-between text-[9pt] font-bold border-b border-black pb-1 mb-2 text-slate-700">
                        <span>{meta.institution || appName} - {meta.exam}</span>
                        <span>বিষয়: {meta.subject}</span>
                      </div>
                    )}

                    {/* Word-like Editable Content Area with Draggable Tables */}
                    <EditableContentArea
                      key={`editable-${idx}-v${repaginateVersion}`}
                      initialHtml={formatMath(manualPages[idx] !== undefined ? manualPages[idx] : pageHtml)}
                      style={style}
                      cols={cols}
                      hasRule={hasRule}
                      isActive={activeEditIdx === idx}
                      pageIndex={idx}
                      totalPages={paginatedPages.length}
                      onFocus={() => setActiveEditIdx(idx)}
                      onClick={() => { if (activeEditIdx !== idx) setActiveEditIdx(idx); }}
                      onBlur={(val) => {
                        setManualPages(prev => {
                          const updated = { ...prev, [idx]: val };
                          const sorted = Object.keys(updated).map(Number).sort((a, b) => a - b);
                          const full = sorted.map(k => updated[k] || '').filter(Boolean).join('\n\n');
                          setDocumentContent(full);
                          return updated;
                        });
                      }}
                      onAddNextPage={handleAddNextPage}
                      onRemoveEmptyPage={handleRemoveEmptyPage}
                      onFocusPage={handleFocusPage}
                      onSyncPageContent={handleSyncPageContent}
                    />

                    {/* Footer */}
                    <footer className="mt-auto pt-2 flex justify-between text-[8.5pt] font-bold border-t border-slate-200 text-slate-500">
                      <span>পাতা: {toBengaliNumber(idx + 1)} / {toBengaliNumber(paginatedPages.length)}</span>
                      <span>{appName} - ডিজিটাল প্রশ্ন ব্যাংক</span>
                    </footer>
                  </div>
                </div>
              );
            })}

            <div className="no-print pt-4 pb-10">
              <Button onClick={() => handleAddNextPage("")} variant="outline" className="gap-2 border-2 border-dashed border-primary/50 text-primary font-black h-16 w-[8.27in] bg-white/50 hover:bg-white transition-all shadow-lg rounded-2xl">
                <PlusCircle className="w-6 h-6" /> নতুন পাতা যোগ করুন
              </Button>
            </div>
          </main>
        </div>
      </div>

      {/* ── AI Question Generator Modal directly in Print Mode ── */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="font-kalpurush max-w-md bg-white border-2 border-indigo-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-indigo-900">
              <BrainCircuit className="h-5 w-5 text-indigo-600" /> AI প্রশ্নপত্র সহকারী
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-600 font-bold">
              বোর্ড পরীক্ষার সিলেবাস অনুযায়ী স্বয়ংক্রিয়ভাবে মানসম্পন্ন প্রশ্ন তৈরি হয়ে সরাসরি পেজে যুক্ত হবে।
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">প্রশ্নের ধরণ</label>
              <Select value={aiType} onValueChange={(v: any) => setAiType(v)}>
                <SelectTrigger className="h-9 font-bold text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="creative">সৃজনশীল প্রশ্ন (উদ্দীপক + ক, খ, গ, ঘ)</SelectItem>
                  <SelectItem value="mcq">বহুনির্বাচনি (MCQ + ৪টি অপশন)</SelectItem>
                  <SelectItem value="short">সংক্ষিপ্ত ও জ্ঞানমূলক প্রশ্ন</SelectItem>
                  <SelectItem value="mixed">মিশ্রিত প্রশ্ন (সৃজনশীল ও MCQ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">প্রশ্নের সংখ্যা</label>
              <Select value={String(aiCount)} onValueChange={(v) => setAiCount(Number(v))}>
                <SelectTrigger className="h-9 font-bold text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">১টি প্রশ্ন</SelectItem>
                  <SelectItem value="2">২টি প্রশ্ন</SelectItem>
                  <SelectItem value="3">৩টি প্রশ্ন (স্ট্যান্ডার্ড)</SelectItem>
                  <SelectItem value="5">৫টি প্রশ্ন</SelectItem>
                  <SelectItem value="10">১০টি প্রশ্ন</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">কঠিনতার মান (Difficulty)</label>
              <Select value={aiDifficulty} onValueChange={(v: any) => setAiDifficulty(v)}>
                <SelectTrigger className="h-9 font-bold text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">সহজ মান (Textbook Direct)</SelectItem>
                  <SelectItem value="medium">সাধারণ মান (Standard)</SelectItem>
                  <SelectItem value="hard">কঠিন মান (Advanced / HOTS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">নির্দিষ্ট টপিক বা অধ্যায়</label>
              <Input
                placeholder="যেমন: বল ও গতির সমীকরণ..."
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                className="h-9 text-xs font-bold"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setAiModalOpen(false)}>বাতিল</Button>
            <Button
              onClick={handleAiGenerateQuestions}
              disabled={aiGenerating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs"
            >
              {aiGenerating ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> তৈরি হচ্ছে...</> : 'প্রশ্ন তৈরি করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .math-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.85em; margin: 0 2px; }
          .math-num { border-bottom: 0.5pt solid black; padding: 0 1px; }
          .math-den { padding: 0 1px; }
          .math-sqrt { display: inline-flex; align-items: center; }
          .math-sqrt-stem { border-top: 0.5pt solid black; padding-top: 1px; }
          .math-sup { font-size: 0.7em; vertical-align: super; }
          .math-sub { font-size: 0.7em; vertical-align: sub; }
          .paper { color: black !important; }
          .content-area .cq-item > div,
          .content-area .cq-item div,
          .content-area .short-item div {
            display: block !important;
          }
          .content-area .cq-mark,
          .content-area .short-mark {
            float: right !important;
            display: inline-block !important;
            user-select: none !important;
          }
        }
        @media print {
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            width: 100% !important;
            overflow: visible !important;
            position: static !important;
          }
          .no-print,
          .no-print * {
            display: none !important;
          }
          .paper-institutional-header,
          .paper header {
            display: block !important;
            visibility: visible !important;
          }
          /* Reset all parent containers so the browser paginates naturally across multiple sheets */
          body > div,
          #__next,
          .min-h-screen,
          .print-view-container,
          .print-body-row,
          .print-canvas-col {
            position: static !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            width: 100% !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
          }
          .print-main-area {
            position: static !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            width: 100% !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            zoom: 1 !important;
            transform: none !important;
            gap: 0 !important;
          }
          .paper {
            position: relative !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: block !important;
            box-sizing: border-box !important;
            border: none !important;
            overflow: hidden !important;
          }
          .paper:last-of-type,
          .paper:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          @page {
            size: auto;
            margin: 0 !important;
          }
        }
      `}} />
    </div>
  );
}
