"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Subscript, 
  Superscript, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  List, 
  ListOrdered, 
  Indent, 
  Outdent, 
  Table as TableIcon, 
  Image as ImageIcon, 
  Minus, 
  Undo, 
  Redo, 
  RemoveFormatting, 
  Highlighter, 
  Palette, 
  Heading1, 
  Heading2, 
  Heading3, 
  Plus, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  FileText,
  Sparkles,
  ChevronDown,
  Info,
  Check,
  Calculator,
  Type,
  Columns2,
  Columns3,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Calendar,
  Divide,
  CornerDownLeft,
  Scissors,
  Copy,
  TableProperties,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';

export interface WordToolbarProps {
  onAddPage?: () => void;
  onDeletePage?: () => void;
  activePageIndex?: number | null;
  totalPages?: number;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
  // Page Layout Props
  onColumnsChange?: (cols: number, hasRule?: boolean) => void;
  currentColumns?: number;
  currentColumnRule?: boolean;
  onOrientationChange?: (orientation: 'portrait' | 'landscape') => void;
  currentOrientation?: 'portrait' | 'landscape';
  onMarginPresetChange?: (preset: 'normal' | 'narrow' | 'wide') => void;
  onPageBorderChange?: (borderStyle: 'none' | 'thin' | 'double' | 'box') => void;
  currentPageBorder?: string;
  className?: string;
}

export function WordToolbar({
  onAddPage,
  onDeletePage,
  activePageIndex = 0,
  totalPages = 1,
  zoomLevel = 100,
  onZoomChange,
  onColumnsChange,
  currentColumns = 1,
  currentColumnRule = false,
  onOrientationChange,
  currentOrientation = 'portrait',
  onMarginPresetChange,
  onPageBorderChange,
  currentPageBorder = 'none',
  className
}: WordToolbarProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'insert' | 'layout'>('home');
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [gridHover, setGridHover] = useState<{ r: number; c: number }>({ r: 3, c: 3 });
  const [tableBorderType, setTableBorderType] = useState<'solid' | 'double' | 'dashed'>('solid');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Helper to execute standard execCommand preserving selection
  const exec = (command: string, value: string = '') => {
    try {
      document.execCommand(command, false, value);
    } catch (e) {
      console.warn('execCommand failed:', command, e);
    }
  };

  // Helper to insert arbitrary HTML at cursor in the currently focused contentEditable
  const insertHtmlAtCursor = (html: string) => {
    const activePaperIdx = typeof activePageIndex === 'number' ? activePageIndex : 0;
    const targetArea = (document.querySelector(`.paper-idx-${activePaperIdx} .content-area`) || 
                        document.querySelector('.paper.ring-4 .content-area') ||
                        document.querySelector('.content-area')) as HTMLElement | null;

    if (!targetArea) return;

    // Check if the current selection is inside targetArea
    const sel = window.getSelection();
    let isInside = false;
    let range: Range | null = null;

    if (sel && sel.rangeCount > 0 && sel.anchorNode) {
      let node: Node | null = sel.anchorNode;
      while (node) {
        if (node === targetArea) {
          isInside = true;
          range = sel.getRangeAt(0);
          break;
        }
        node = node.parentNode;
      }
    }

    if (isInside && range) {
      try {
        targetArea.focus();
        if (document.execCommand('insertHTML', false, html)) {
          return;
        }
      } catch (e) {}

      try {
        range.deleteContents();
        const el = document.createElement('div');
        el.innerHTML = html;
        const frag = document.createDocumentFragment();
        let node: Node | null;
        let lastNode: Node | null = null;
        while ((node = el.firstChild)) {
          lastNode = frag.appendChild(node);
        }
        range.insertNode(frag);
        if (lastNode && sel) {
          const newRange = document.createRange();
          newRange.setStartAfter(lastNode);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
        return;
      } catch (err) {
        console.warn('Range insertion error, falling back:', err);
      }
    }

    // Default fallback: focus into targetArea and append
    targetArea.focus();
    targetArea.insertAdjacentHTML('beforeend', html);
  };

  // Table manipulation helpers
  const getActiveTableCell = (): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode) return null;
    let node: Node | null = sel.anchorNode;
    while (node) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') return node as HTMLTableCellElement;
      if (node instanceof HTMLElement && node.classList.contains('content-area')) break;
      node = node.parentNode;
    }
    return null;
  };

  const insertTableRow = (below = true) => {
    const td = getActiveTableCell();
    if (!td) return alert('প্রথমে যেকোনো টেবিল বা সেলে কার্সর রাখুন।');
    const tr = td.closest('tr');
    const table = td.closest('table');
    if (!tr || !table) return;
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
    if (below) {
      tr.parentNode?.insertBefore(newTr, tr.nextSibling);
    } else {
      tr.parentNode?.insertBefore(newTr, tr);
    }
  };

  const insertTableColumn = (right = true) => {
    const td = getActiveTableCell();
    if (!td) return alert('প্রথমে যেকোনো টেবিল বা সেলে কার্সর রাখুন।');
    const tr = td.closest('tr');
    const table = td.closest('table');
    if (!tr || !table) return;
    const colIndex = Array.from(tr.children).indexOf(td);
    const rows = table.querySelectorAll('tr');
    rows.forEach(r => {
      const newTd = document.createElement('td');
      newTd.style.border = '1px solid #333';
      newTd.style.padding = '8px 10px';
      newTd.style.minWidth = '40px';
      newTd.style.verticalAlign = 'top';
      newTd.innerHTML = '<br/>';
      const refChild = r.children[right ? colIndex + 1 : colIndex];
      if (refChild) {
        r.insertBefore(newTd, refChild);
      } else {
        r.appendChild(newTd);
      }
    });
  };

  const deleteTableRow = () => {
    const td = getActiveTableCell();
    if (!td) return alert('প্রথমে যেকোনো টেবিল বা সেলে কার্সর রাখুন।');
    const tr = td.closest('tr');
    if (tr) {
      tr.remove();
    }
  };

  const deleteTableColumn = () => {
    const td = getActiveTableCell();
    if (!td) return alert('প্রথমে যেকোনো টেবিল বা সেলে কার্সর রাখুন।');
    const tr = td.closest('tr');
    const table = td.closest('table');
    if (!tr || !table) return;
    const colIndex = Array.from(tr.children).indexOf(td);
    const rows = table.querySelectorAll('tr');
    rows.forEach(r => {
      if (r.children[colIndex]) {
        r.children[colIndex].remove();
      }
    });
  };

  const deleteActiveTable = () => {
    const td = getActiveTableCell();
    if (!td) return alert('প্রথমে যেকোনো টেবিল বা সেলে কার্সর রাখুন।');
    const table = td.closest('table');
    if (table) {
      table.remove();
    }
  };

  // Delete active callout box
  const deleteActiveNoteBox = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return alert('মুছে ফেলার জন্য নোট বক্সের ভেতরে ক্লিক করুন।');
    let node: Node | null = sel.anchorNode;
    while (node) {
      if (node instanceof HTMLElement && node.classList.contains('callout-note-box')) {
        node.remove();
        return;
      }
      node = node.parentNode;
    }
    // Fallback: look for last callout box in active paper
    const activeEl = document.querySelector('.paper.ring-4 .callout-note-box') || 
                     document.querySelector('.callout-note-box:hover') ||
                     document.querySelector('.callout-note-box');
    if (activeEl) {
      activeEl.remove();
    } else {
      alert('কোনো নোট বক্স খুঁজে পাওয়া যায়নি। নোট বক্সের ভেতরে ক্লিক করে আবার চাপুন।');
    }
  };

  // Font families supported
  const FONT_FAMILIES = [
    { label: 'কালপুরুষ (Kalpurush)', value: "'Kalpurush', sans-serif" },
    { label: 'সোলাইমান লিপি (SolaimanLipi)', value: "'SolaimanLipi', sans-serif" },
    { label: 'সুতোন্নীএমজে (SutonnyMJ)', value: "'SutonnyMJ', sans-serif" },
    { label: 'Noto Sans Bengali', value: "'Noto Sans Bengali', sans-serif" },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
    { label: 'Courier New (মোনোস্পেস)', value: "'Courier New', Courier, monospace" },
  ];

  const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];

  const LINE_SPACINGS = [
    { label: '1.0 (একক)', value: '1.0' },
    { label: '1.15 (স্ট্যান্ডার্ড)', value: '1.15' },
    { label: '1.2 (ডিফল্ট)', value: '1.2' },
    { label: '1.5 (দেড় গুণ)', value: '1.5' },
    { label: '2.0 (দ্বিগুণ)', value: '2.0' },
  ];

  const TEXT_COLORS = [
    { label: 'কালো', value: '#000000' },
    { label: 'গাঢ় নীল', value: '#1e3a8a' },
    { label: 'নীল', value: '#2563eb' },
    { label: 'লাল', value: '#dc2626' },
    { label: 'সবুজ', value: '#16a34a' },
    { label: 'বেগুনি', value: '#7c3aed' },
    { label: 'কমলা', value: '#ea580c' },
  ];

  const HIGHLIGHT_COLORS = [
    { label: 'হলুদ', value: '#fef08a' },
    { label: 'হালকা সবুজ', value: '#bbf7d0' },
    { label: 'হালকা নীল', value: '#bae6fd' },
    { label: 'গোলাপি', value: '#fbcfe8' },
    { label: 'কমলা', value: '#fed7aa' },
    { label: 'মুছুন (কোনো রং নয়)', value: 'transparent' },
  ];

  // Math & Special Symbols Palette
  const MATH_SYMBOLS = [
    '√', '∛', '∑', '∏', 'π', 'θ', 'α', 'β', 'γ', 'δ', 'λ', 'μ', 'σ', 'φ', 'ω',
    '±', '×', '÷', '≠', '≈', '≤', '≥', '≡', '∞', '°', '∠', '△', '⊥', '∥', '→',
    '²', '³', '⁴', 'ⁿ', '₁', '₂', '₃', '½', '¼', '¾', '∈', '∉', '⊂', '⊆', '∪', '∩'
  ];

  // Callout Boxes - with explicit delete button and proper container
  const CALLOUT_BOXES = [
    {
      title: 'বিশেষ দ্রষ্টব্য (নীল)',
      border: '#2563eb',
      bg: '#eff6ff',
      icon: '💡',
      label: 'বিশেষ দ্রষ্টব্য:'
    },
    {
      title: 'গুরুত্বপূর্ণ সূত্র (বেগুনি)',
      border: '#7c3aed',
      bg: '#f5f3ff',
      icon: '📐',
      label: 'প্রয়োজনীয় সূত্র:'
    },
    {
      title: 'সতর্কতা / মনে রেখো (কমলা)',
      border: '#ea580c',
      bg: '#fff7ed',
      icon: '⚠️',
      label: 'মনে রেখো:'
    },
    {
      title: 'নমুনা উদাহরণ / সমাধান (সবুজ)',
      border: '#16a34a',
      bg: '#f0fdf4',
      icon: '✓',
      label: 'উদাহরণ:'
    },
    {
      title: 'প্রশ্ন বা টাস্ক বক্স (গাঢ় ধূসর)',
      border: '#475569',
      bg: '#f8fafc',
      icon: '📝',
      label: 'অনুশীলন কাজ:'
    }
  ];

  // Insert Table
  const handleInsertTable = (customRows?: number, customCols?: number, customBorderType?: 'solid' | 'double' | 'dashed') => {
    const rCount = customRows || tableRows || 3;
    const cCount = customCols || tableCols || 3;
    const bType = customBorderType || tableBorderType || 'solid';
    const borderStyleCss = bType === 'double' ? '3px double #000' : 
                           bType === 'dashed' ? '1.5px dashed #000' : '1.5px solid #000';
    let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 12px 0; border: ${borderStyleCss}; font-size: inherit; table-layout: fixed;">\n<tbody>\n`;
    for (let r = 0; r < rCount; r++) {
      tableHtml += `  <tr>\n`;
      for (let c = 0; c < cCount; c++) {
        const isHeader = r === 0;
        tableHtml += `    <td style="border: 1px solid #333; padding: 8px 10px; min-width: 40px; height: 32px; vertical-align: top; ${isHeader ? 'background-color: #f8fafc; font-weight: bold;' : ''}"><br/></td>\n`;
      }
      tableHtml += `  </tr>\n`;
    }
    tableHtml += `</tbody>\n</table>\n<p><br/></p>`;
    insertHtmlAtCursor(tableHtml);
    setTableDialogOpen(false);
  };

  // Insert Callout Box WITH 1-click delete button (hidden on print)
  const handleInsertCallout = (box: typeof CALLOUT_BOXES[0]) => {
    const boxHtml = `
      <div class="callout-note-box relative group" style="border-left: 4px solid ${box.border}; background-color: ${box.bg}; padding: 10px 14px; margin: 12px 0; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); position: relative;">
        <button type="button" contenteditable="false" class="no-print callout-delete-btn" onclick="const p=this.closest('.callout-note-box'); const ca=p?.closest('.content-area'); p?.remove(); if(ca) ca.dispatchEvent(new Event('input', {bubbles:true}));" title="নোট বক্সটি মুছে ফেলুন" style="position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; background: rgba(0,0,0,0.08); color: #dc2626; border: 1px solid rgba(0,0,0,0.15); border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; line-height: 1;">✕</button>
        <p style="margin: 0; font-weight: bold; color: ${box.border}; display: flex; align-items: center; gap: 6px;">
          <span>${box.icon}</span> <span>${box.label}</span>
        </p>
        <p style="margin: 4px 0 0 0; color: #1e293b;">এখানে বিবরণ বা টেক্সট লিখুন...</p>
      </div>
      <p><br/></p>
    `;
    insertHtmlAtCursor(boxHtml);
  };

  // Insert MCQ 4-Option Grid (ক, খ, গ, ঘ)
  const handleInsertMcqGrid = () => {
    const mcqHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 8px 0; border: none; font-size: inherit;">
        <tbody>
          <tr>
            <td style="width: 50%; padding: 6px 8px; border: none;">(ক)&nbsp;</td>
            <td style="width: 50%; padding: 6px 8px; border: none;">(খ)&nbsp;</td>
          </tr>
          <tr>
            <td style="width: 50%; padding: 6px 8px; border: none;">(গ)&nbsp;</td>
            <td style="width: 50%; padding: 6px 8px; border: none;">(ঘ)&nbsp;</td>
          </tr>
        </tbody>
      </table>
      <p><br/></p>
    `;
    insertHtmlAtCursor(mcqHtml);
  };

  // Insert Fraction (ভগ্নাংশ)
  const handleInsertFraction = () => {
    const fracHtml = `
      <span class="math-frac" style="display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.9em; margin: 0 3px;">
        <span class="math-num" style="border-bottom: 1px solid currentColor; padding: 0 3px;">১</span>
        <span class="math-den" style="padding: 0 3px;">২</span>
      </span>&nbsp;
    `;
    insertHtmlAtCursor(fracHtml);
  };

  // Insert Today's Date
  const handleInsertDate = (bengali = true) => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const dateStr = `${day}/${month}/${year}`;
    const resultStr = bengali ? dateStr.replace(/\d/g, d => bengaliDigits[parseInt(d)]) : dateStr;
    insertHtmlAtCursor(`<strong>তারিখ: ${resultStr}</strong> `);
  };

  // Insert Image from file
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      const imgHtml = `<p style="text-align: center; margin: 12px 0;"><img src="${dataUri}" alt="Image" style="max-width: 100%; max-height: 4in; height: auto; border-radius: 4px; display: inline-block;" /></p><p><br/></p>`;
      insertHtmlAtCursor(imgHtml);
      if (imageFileInputRef.current) imageFileInputRef.current.value = '';
      setImageDialogOpen(false);
    };
    reader.readAsDataURL(file);
  };

  // Insert Image from URL
  const handleInsertImageUrl = () => {
    if (!imageUrl.trim()) return;
    const imgHtml = `<p style="text-align: center; margin: 12px 0;"><img src="${imageUrl.trim()}" alt="Image" style="max-width: 100%; max-height: 4in; height: auto; border-radius: 4px; display: inline-block;" /></p><p><br/></p>`;
    insertHtmlAtCursor(imgHtml);
    setImageUrl('');
    setImageDialogOpen(false);
  };

  // Change font family
  const handleFontFamily = (fontVal: string) => {
    exec('fontName', fontVal);
  };

  // Change font size
  const handleFontSize = (pt: number) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const span = document.createElement('span');
      span.style.fontSize = `${pt}pt`;
      const range = sel.getRangeAt(0);
      try {
        span.appendChild(range.extractContents());
        range.insertNode(span);
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } catch (e) {
        exec('fontSize', '3');
      }
    } else {
      const activeEl = document.querySelector('.content-area:focus') || 
                       document.querySelector('.paper.ring-4 .content-area');
      if (activeEl instanceof HTMLElement) {
        activeEl.style.fontSize = `${pt}pt`;
      }
    }
  };

  // Change Line Spacing
  const handleLineHeight = (val: string) => {
    const activeEl = document.querySelector('.content-area:focus') || 
                     document.querySelector('.paper.ring-4 .content-area');
    if (activeEl instanceof HTMLElement) {
      activeEl.style.lineHeight = val;
    }
  };

  // Format Heading (H1, H2, H3, P)
  const handleHeading = (tag: string) => {
    exec('formatBlock', tag);
  };

  return (
    <div className={cn("no-print bg-slate-50 border-b border-slate-200 shadow-sm z-40 select-none font-kalpurush", className)}>
      {/* ── Word Ribbon Tabs ── */}
      <div className="flex items-center gap-1 px-4 pt-1.5 border-b border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={cn(
            "px-4 py-1.5 text-xs font-black rounded-t-md transition-all border-t-2",
            activeTab === 'home' 
              ? "bg-slate-50 text-indigo-700 border-indigo-600 shadow-sm" 
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          হোম (Home)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('insert')}
          className={cn(
            "px-4 py-1.5 text-xs font-black rounded-t-md transition-all border-t-2",
            activeTab === 'insert' 
              ? "bg-slate-50 text-indigo-700 border-indigo-600 shadow-sm" 
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          ইনসার্ট (Insert)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('layout')}
          className={cn(
            "px-4 py-1.5 text-xs font-black rounded-t-md transition-all border-t-2",
            activeTab === 'layout' 
              ? "bg-slate-50 text-indigo-700 border-indigo-600 shadow-sm" 
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          পেজ লেআউট (Layout)
        </button>

        {/* Right side page indicator & zoom */}
        <div className="ml-auto flex items-center gap-2 text-xs font-bold text-slate-600 py-1">
          {totalPages > 0 && (
            <span className="bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 text-[11px] font-black text-indigo-700">
              পাতা: {(activePageIndex !== null ? activePageIndex + 1 : 1)} / {totalPages}
            </span>
          )}
          {onZoomChange && (
            <div className="flex items-center gap-1 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
              <button 
                onMouseDown={e => e.preventDefault()}
                onClick={() => onZoomChange(Math.max(50, zoomLevel - 10))}
                className="p-1 hover:bg-white rounded text-slate-700" 
                title="জুম কমান"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-black w-8 text-center">{zoomLevel}%</span>
              <button 
                onMouseDown={e => e.preventDefault()}
                onClick={() => onZoomChange(Math.min(150, zoomLevel + 10))}
                className="p-1 hover:bg-white rounded text-slate-700" 
                title="জুম বাড়ান"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Ribbon Toolbar Panels ── */}
      <div className="px-4 py-2 flex flex-wrap items-center gap-2 text-slate-700 min-h-[46px]">
        {/* ═══════════ TAB 1: HOME (হোম) ═══════════ */}
        {activeTab === 'home' && (
          <>
            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5 border-r border-slate-300 pr-2">
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('undo')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="পূর্বাবস্থা (Undo - Ctrl+Z)"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('redo')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="পুনরাবৃত্তি (Redo - Ctrl+Y)"
              >
                <Redo className="w-4 h-4" />
              </button>
            </div>

            {/* Font Family Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onMouseDown={e => e.preventDefault()}
                  className="h-8 px-2.5 text-xs font-bold bg-white border border-slate-300 rounded hover:bg-slate-100 flex items-center gap-1.5 min-w-[130px] justify-between shadow-xs"
                >
                  <span className="truncate">কালপুরুষ</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="font-kalpurush w-52 bg-white border border-slate-200">
                {FONT_FAMILIES.map((f) => (
                  <DropdownMenuItem
                    key={f.value}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleFontFamily(f.value)}
                    className="text-xs font-bold cursor-pointer hover:bg-indigo-50 hover:text-indigo-700"
                    style={{ fontFamily: f.value }}
                  >
                    {f.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Font Size Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onMouseDown={e => e.preventDefault()}
                  className="h-8 px-2 text-xs font-bold bg-white border border-slate-300 rounded hover:bg-slate-100 flex items-center gap-1 min-w-[54px] justify-between shadow-xs"
                >
                  <span>10.5</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="font-kalpurush max-h-56 overflow-y-auto bg-white border border-slate-200">
                {FONT_SIZES.map((size) => (
                  <DropdownMenuItem
                    key={size}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleFontSize(size)}
                    className="text-xs font-bold cursor-pointer hover:bg-indigo-50"
                  >
                    {size} pt
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Heading / Style Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onMouseDown={e => e.preventDefault()}
                  className="h-8 px-2.5 text-xs font-bold bg-white border border-slate-300 rounded hover:bg-slate-100 flex items-center gap-1.5 shadow-xs"
                  title="শিরোনাম ও স্টাইল"
                >
                  <Type className="w-3.5 h-3.5 text-indigo-600" />
                  <span>স্টাইল</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="font-kalpurush w-44 bg-white border border-slate-200">
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => handleHeading('p')} className="text-xs font-bold cursor-pointer">স্বাভাবিক টেক্সট (Normal)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => handleHeading('h1')} className="text-base font-black cursor-pointer text-indigo-700">শিরোনাম ১ (H1)</DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => handleHeading('h2')} className="text-sm font-black cursor-pointer text-blue-700">শিরোনাম ২ (H2)</DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => handleHeading('h3')} className="text-xs font-black cursor-pointer text-slate-800">শিরোনাম ৩ (H3)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => handleHeading('blockquote')} className="text-xs italic cursor-pointer">উদ্ধৃতি (Blockquote)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Text Formatting Group */}
            <div className="flex items-center gap-0.5 border-l border-r border-slate-300 px-2">
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('bold')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors font-black"
                title="বোল্ড / মোটা (Ctrl+B)"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('italic')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors italic"
                title="ইটালিক / বাঁকা (Ctrl+I)"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('underline')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors underline"
                title="আন্ডারলাইন / নিচে দাগ (Ctrl+U)"
              >
                <Underline className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('strikeThrough')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors line-through"
                title="স্ট্রাইক / মাঝে দাগ"
              >
                <Strikethrough className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('subscript')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="সাবস্ক্রিপ্ট (x₂)"
              >
                <Subscript className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('superscript')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="সুপারস্ক্রিপ্ট (x²)"
              >
                <Superscript className="w-4 h-4" />
              </button>
            </div>

            {/* Colors: Text & Highlight */}
            <div className="flex items-center gap-1 border-r border-slate-300 pr-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onMouseDown={e => e.preventDefault()}
                    className="p-1.5 hover:bg-slate-200 rounded flex items-center gap-0.5"
                    title="টেক্সট রং (Font Color)"
                  >
                    <Palette className="w-4 h-4 text-indigo-700" />
                    <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="font-kalpurush p-2 bg-white border border-slate-200 w-44">
                  <div className="text-[10px] font-black text-slate-500 uppercase mb-1.5">টেক্সটের রং নির্বাচন:</div>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {TEXT_COLORS.map(c => (
                      <button
                        key={c.value}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => exec('foreColor', c.value)}
                        className="w-7 h-7 rounded border border-slate-300 hover:scale-110 transition-transform shadow-xs"
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <span className="text-[10px] font-bold">কাস্টম:</span>
                    <input 
                      type="color" 
                      onChange={e => exec('foreColor', e.target.value)} 
                      className="w-full h-6 cursor-pointer p-0 border-0" 
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onMouseDown={e => e.preventDefault()}
                    className="p-1.5 hover:bg-slate-200 rounded flex items-center gap-0.5"
                    title="টেক্সট হাইলাইটার (Highlight)"
                  >
                    <Highlighter className="w-4 h-4 text-amber-500" />
                    <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="font-kalpurush p-2 bg-white border border-slate-200 w-40">
                  <div className="text-[10px] font-black text-slate-500 uppercase mb-1.5">হাইলাইট মার্কার:</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {HIGHLIGHT_COLORS.map(h => (
                      <button
                        key={h.value}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => exec('hiliteColor', h.value)}
                        className="h-6 rounded border border-slate-300 hover:scale-105 transition-transform flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: h.value }}
                        title={h.label}
                      >
                        {h.value === 'transparent' ? '✕' : ''}
                      </button>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('removeFormat')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors text-slate-500 hover:text-destructive"
                title="ফরম্যাটিং মুছুন (Clear Formatting)"
              >
                <RemoveFormatting className="w-4 h-4" />
              </button>
            </div>

            {/* Alignment Group */}
            <div className="flex items-center gap-0.5 border-r border-slate-300 pr-2">
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('justifyLeft')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="বাম সারিবদ্ধ (Align Left - Ctrl+L)"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('justifyCenter')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="মাঝখানে সারিবদ্ধ (Center - Ctrl+E)"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('justifyRight')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="ডান সারিবদ্ধ (Align Right - Ctrl+R)"
              >
                <AlignRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('justifyFull')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="উভয় পাশে সমান (Justify)"
              >
                <AlignJustify className="w-4 h-4" />
              </button>
            </div>

            {/* Lists & Indentation */}
            <div className="flex items-center gap-0.5 border-r border-slate-300 pr-2">
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('insertUnorderedList')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="বুলেট পয়েন্ট তালিকা (Bullet List)"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('insertOrderedList')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="ক্রমিক সংখ্যা তালিকা (Numbered List)"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('outdent')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="ইনডেন্ট কমান (Outdent)"
              >
                <Outdent className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => exec('indent')}
                className="p-1.5 hover:bg-slate-200 active:bg-slate-300 rounded transition-colors"
                title="ইনডেন্ট বাড়ান (Indent)"
              >
                <Indent className="w-4 h-4" />
              </button>
            </div>

            {/* Line Spacing Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onMouseDown={e => e.preventDefault()}
                  className="h-8 px-2 text-xs font-bold bg-white border border-slate-300 rounded hover:bg-slate-100 flex items-center gap-1 shadow-xs"
                  title="লাইন স্পেসিং"
                >
                  <span>লাইন ফাঁক</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="font-kalpurush bg-white border border-slate-200">
                {LINE_SPACINGS.map(ls => (
                  <DropdownMenuItem
                    key={ls.value}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleLineHeight(ls.value)}
                    className="text-xs font-bold cursor-pointer hover:bg-indigo-50"
                  >
                    {ls.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* ═══════════ TAB 2: INSERT (ইনসার্ট) ═══════════ */}
        {activeTab === 'insert' && (
          <>
            {/* 1. Table Menu with Complete Controls */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={e => e.preventDefault()}
                  className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 shadow-xs"
                >
                  <TableIcon className="w-4 h-4 text-indigo-600" />
                  ছক / টেবিল
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="font-kalpurush w-64 p-3 bg-white border border-slate-200 shadow-xl">
                <div className="text-xs font-black text-slate-700 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><TableIcon className="w-3.5 h-3.5 text-indigo-600" /> টেবিল নির্বাচন করুন</span>
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {gridHover.r} × {gridHover.c}
                  </span>
                </div>

                {/* 5x5 Visual Quick Selector */}
                <div className="grid grid-cols-5 gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg mb-3">
                  {[1, 2, 3, 4, 5].map(r => 
                    [1, 2, 3, 4, 5].map(c => {
                      const isHovered = r <= gridHover.r && c <= gridHover.c;
                      return (
                        <div
                          key={`${r}-${c}`}
                          onMouseEnter={() => setGridHover({ r, c })}
                          onClick={() => handleInsertTable(r, c)}
                          className={cn(
                            "w-8 h-7 rounded border transition-all cursor-pointer flex items-center justify-center text-[10px]",
                            isHovered 
                              ? "bg-indigo-600 border-indigo-700 shadow-xs" 
                              : "bg-white border-slate-300 hover:border-slate-400"
                          )}
                          title={`${r} সারি × ${c} কলাম টেবিল ইনসার্ট`}
                        />
                      );
                    })
                  )}
                </div>

                {/* Quick Rows & Cols Inputs */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">সারি (Rows)</label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={tableRows}
                        onChange={e => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-7 text-xs font-bold"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">কলাম (Cols)</label>
                      <Input
                        type="number"
                        min={1}
                        max={15}
                        value={tableCols}
                        onChange={e => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-7 text-xs font-bold"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleInsertTable(tableRows, tableCols)}
                    className="w-full h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> টেবিল তৈরি করুন
                  </Button>
                </div>

                <DropdownMenuSeparator className="my-2" />
                <div className="px-1 py-1 text-[10px] font-black text-slate-400 uppercase">টেবিল এডিটিং টুলস:</div>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => insertTableRow(false)} className="text-xs font-bold cursor-pointer">
                  উপরে সারি যোগ করুন (Row Above)
                </DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => insertTableRow(true)} className="text-xs font-bold cursor-pointer">
                  নিচে সারি যোগ করুন (Row Below)
                </DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => insertTableColumn(false)} className="text-xs font-bold cursor-pointer">
                  বামে কলাম যোগ করুন (Column Left)
                </DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => insertTableColumn(true)} className="text-xs font-bold cursor-pointer">
                  ডানে কলাম যোগ করুন (Column Right)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={deleteTableRow} className="text-xs font-bold cursor-pointer text-amber-700">
                  বর্তমান সারি মুছুন (Delete Row)
                </DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={deleteTableColumn} className="text-xs font-bold cursor-pointer text-amber-700">
                  বর্তমান কলাম মুছুন (Delete Column)
                </DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={deleteActiveTable} className="text-xs font-bold cursor-pointer text-destructive">
                  পুরো টেবিল মুছুন (Delete Table)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 2. Insert Image Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setImageDialogOpen(true)}
              className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 shadow-xs"
            >
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              ছবি যোগ করুন
            </Button>

            {/* 3. Callout Box Dropdown & Delete Tool */}
            <div className="flex items-center gap-1 border-l border-r border-slate-300 px-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onMouseDown={e => e.preventDefault()}
                    className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 shadow-xs"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    নোট বক্স
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="font-kalpurush w-56 bg-white border border-slate-200">
                  {CALLOUT_BOXES.map(box => (
                    <DropdownMenuItem
                      key={box.title}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleInsertCallout(box)}
                      className="text-xs font-bold cursor-pointer flex items-center gap-2 hover:bg-indigo-50"
                    >
                      <span>{box.icon}</span>
                      <span>{box.title}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Dedicated Note Box Delete Button to fix user issue! */}
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={deleteActiveNoteBox}
                className="h-8 px-2 text-xs font-bold rounded border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1 shadow-xs transition-colors"
                title="কার্সর যেখানে আছে সেই নোট বক্সটি সম্পূর্ণ মুছে ফেলুন"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                নোট বক্স মুছুন
              </button>
            </div>

            {/* 4. MCQ 4-Option Grid */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseDown={e => e.preventDefault()}
              onClick={handleInsertMcqGrid}
              className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 shadow-xs"
              title="MCQ এর ৪টি অপশন ক, খ, গ, ঘ গ্রিড ছক ইনসার্ট করুন"
            >
              <FileText className="w-4 h-4 text-orange-600" />
              MCQ অপশন ছক
            </Button>

            {/* 5. Math Fraction */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseDown={e => e.preventDefault()}
              onClick={handleInsertFraction}
              className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 shadow-xs"
              title="লব ও হর যুক্ত ভগ্নাংশ যোগ করুন"
            >
              <Divide className="w-4 h-4 text-purple-600" />
              ভগ্নাংশ
            </Button>

            {/* 6. Math & Special Symbols Palette Dropdown */}
            <DropdownMenu open={symbolsOpen} onOpenChange={setSymbolsOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={e => e.preventDefault()}
                  className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 shadow-xs"
                >
                  <Calculator className="w-4 h-4 text-purple-600" />
                  প্রতীক ও চিহ্ন
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="font-kalpurush p-3 bg-white border border-slate-200 w-72">
                <div className="text-[10px] font-black text-slate-500 uppercase mb-2">ক্লিক করে পেস্ট করুন:</div>
                <div className="grid grid-cols-7 gap-1">
                  {MATH_SYMBOLS.map(sym => (
                    <button
                      key={sym}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        insertHtmlAtCursor(` ${sym} `);
                        setSymbolsOpen(false);
                      }}
                      className="h-8 w-8 text-sm font-black rounded hover:bg-indigo-100 hover:text-indigo-700 border border-slate-200 transition-colors flex items-center justify-center bg-slate-50"
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 7. Date & Horizontal Line */}
            <div className="flex items-center gap-1 border-l border-slate-300 pl-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleInsertDate(true)}
                className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 shadow-xs"
                title="আজকের তারিখ যোগ করুন"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                তারিখ
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onMouseDown={e => e.preventDefault()}
                onClick={() => insertHtmlAtCursor('<hr style="border: none; border-top: 1.5px solid #000; margin: 12px 0;" /><p><br/></p>')}
                className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 shadow-xs"
                title="অনুভূমিক বিভাজক দাগ যোগ করুন"
              >
                <Minus className="w-4 h-4" />
                দাগ
              </Button>
            </div>
          </>
        )}

        {/* ═══════════ TAB 3: PAGE LAYOUT (পেজ লেআউট) ═══════════ */}
        {activeTab === 'layout' && (
          <>
            {/* 1. Multi-Column Controls (কলাম যোগ করুন - ১ কলাম, ২ কলাম, ৩ কলাম ও মাঝে দাগ) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={e => e.preventDefault()}
                  className="h-8 gap-1.5 font-bold text-xs bg-white border-indigo-400 text-indigo-700 hover:bg-indigo-50 shadow-xs"
                  title="পৃষ্ঠার লেখাগুলো একাধিক কলামে বিভক্ত করুন"
                >
                  <Columns2 className="w-4 h-4 text-indigo-600" />
                  <span>কলাম ({currentColumns === 2 ? '২টি' : currentColumns === 3 ? '৩টি' : '১টি'})</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="font-kalpurush w-56 bg-white border border-slate-200">
                <div className="px-2 py-1 text-[10px] font-black text-slate-500 uppercase">কলামের সংখ্যা নির্বাচন:</div>
                <DropdownMenuItem 
                  onMouseDown={e => e.preventDefault()} 
                  onClick={() => onColumnsChange?.(1, false)} 
                  className={cn("text-xs font-bold cursor-pointer flex items-center justify-between", currentColumns === 1 && "bg-indigo-50 text-indigo-700")}
                >
                  <div className="flex items-center gap-2">
                    <Square className="w-4 h-4 text-slate-500" />
                    <span>১টি কলাম (সাধারণ / ফুল পেজ)</span>
                  </div>
                  {currentColumns === 1 && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onMouseDown={e => e.preventDefault()} 
                  onClick={() => onColumnsChange?.(2, currentColumnRule)} 
                  className={cn("text-xs font-bold cursor-pointer flex items-center justify-between", currentColumns === 2 && "bg-indigo-50 text-indigo-700")}
                >
                  <div className="flex items-center gap-2">
                    <Columns2 className="w-4 h-4 text-indigo-600" />
                    <span>২টি কলাম (প্রশ্নপত্র ও লেকচার শিট)</span>
                  </div>
                  {currentColumns === 2 && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onMouseDown={e => e.preventDefault()} 
                  onClick={() => onColumnsChange?.(3, currentColumnRule)} 
                  className={cn("text-xs font-bold cursor-pointer flex items-center justify-between", currentColumns === 3 && "bg-indigo-50 text-indigo-700")}
                >
                  <div className="flex items-center gap-2">
                    <Columns3 className="w-4 h-4 text-indigo-600" />
                    <span>৩টি কলাম (নিউজলেটার / তিন সারি)</span>
                  </div>
                  {currentColumns === 3 && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-[10px] font-black text-slate-500 uppercase">কলামের মাঝে বিভাজক দাগ:</div>
                <DropdownMenuItem 
                  onMouseDown={e => e.preventDefault()} 
                  onClick={() => onColumnsChange?.(currentColumns || 2, !currentColumnRule)} 
                  className="text-xs font-bold cursor-pointer flex items-center justify-between"
                >
                  <span>কলামের মাঝে কালো দাগ (Line Between)</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-black", currentColumnRule ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                    {currentColumnRule ? 'চালু আছে' : 'বন্ধ'}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 2. Orientation (পোর্ট্রেট / ল্যান্ডস্কেপ) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={e => e.preventDefault()}
                  className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-slate-100 shadow-xs"
                >
                  {currentOrientation === 'landscape' ? <RectangleHorizontal className="w-4 h-4 text-blue-600" /> : <RectangleVertical className="w-4 h-4 text-blue-600" />}
                  <span>{currentOrientation === 'landscape' ? 'ল্যান্ডস্কেপ' : 'পোর্ট্রেট'}</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="font-kalpurush w-44 bg-white border border-slate-200">
                <DropdownMenuItem 
                  onMouseDown={e => e.preventDefault()} 
                  onClick={() => onOrientationChange?.('portrait')} 
                  className={cn("text-xs font-bold cursor-pointer flex items-center justify-between", currentOrientation === 'portrait' && "bg-indigo-50 text-indigo-700")}
                >
                  <div className="flex items-center gap-2">
                    <RectangleVertical className="w-4 h-4" />
                    <span>পোর্ট্রেট (খাড়া পাতা)</span>
                  </div>
                  {currentOrientation === 'portrait' && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onMouseDown={e => e.preventDefault()} 
                  onClick={() => onOrientationChange?.('landscape')} 
                  className={cn("text-xs font-bold cursor-pointer flex items-center justify-between", currentOrientation === 'landscape' && "bg-indigo-50 text-indigo-700")}
                >
                  <div className="flex items-center gap-2">
                    <RectangleHorizontal className="w-4 h-4" />
                    <span>ল্যান্ডস্কেপ (আড়াআড়ি)</span>
                  </div>
                  {currentOrientation === 'landscape' && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 3. Margin Presets */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={e => e.preventDefault()}
                  className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-slate-100 shadow-xs"
                >
                  <Square className="w-3.5 h-3.5 text-slate-600" />
                  <span>মার্জিন প্রিসেট</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="font-kalpurush w-52 bg-white border border-slate-200">
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => onMarginPresetChange?.('normal')} className="text-xs font-bold cursor-pointer">
                  সাধারণ (Normal - ০.৫ ইঞ্চি)
                </DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => onMarginPresetChange?.('narrow')} className="text-xs font-bold cursor-pointer">
                  ন্যারো / টাইট (Narrow - ০.২৫ ইঞ্চি)
                </DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => onMarginPresetChange?.('wide')} className="text-xs font-bold cursor-pointer">
                  চওড়া (Wide - ১.০ ইঞ্চি)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-[10px] text-slate-400">
                  * নির্দিষ্ট পাতার মার্জিন পরিবর্তন করতে বাম সাইডবার ব্যবহার করুন।
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 4. Page Border Style */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={e => e.preventDefault()}
                  className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-slate-100 shadow-xs"
                >
                  <Square className="w-3.5 h-3.5 text-purple-600" />
                  <span>পেজ বর্ডার</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="font-kalpurush w-44 bg-white border border-slate-200">
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => onPageBorderChange?.('none')} className={cn("text-xs font-bold cursor-pointer flex items-center justify-between", currentPageBorder === 'none' && "bg-indigo-50")}>
                  <span>বর্ডার ছাড়া (None)</span>
                  {currentPageBorder === 'none' && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => onPageBorderChange?.('thin')} className={cn("text-xs font-bold cursor-pointer flex items-center justify-between", currentPageBorder === 'thin' && "bg-indigo-50")}>
                  <span>চিকন বর্ডার (Thin)</span>
                  {currentPageBorder === 'thin' && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => onPageBorderChange?.('double')} className={cn("text-xs font-bold cursor-pointer flex items-center justify-between", currentPageBorder === 'double' && "bg-indigo-50")}>
                  <span>ডাবল বর্ডার (Double)</span>
                  {currentPageBorder === 'double' && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onMouseDown={e => e.preventDefault()} onClick={() => onPageBorderChange?.('box')} className={cn("text-xs font-bold cursor-pointer flex items-center justify-between", currentPageBorder === 'box' && "bg-indigo-50")}>
                  <span>বক্স ফ্রেম (Box)</span>
                  {currentPageBorder === 'box' && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 5. Page Management Controls */}
            <div className="flex items-center gap-1 border-l border-slate-300 pl-2">
              {onAddPage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={e => e.preventDefault()}
                  onClick={onAddPage}
                  className="h-8 gap-1.5 font-bold text-xs bg-white border-emerald-500 text-emerald-700 hover:bg-emerald-50 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  নতুন পাতা যোগ
                </Button>
              )}

              {onDeletePage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={e => e.preventDefault()}
                  onClick={onDeletePage}
                  className="h-8 gap-1.5 font-bold text-xs bg-white border-red-300 text-red-600 hover:bg-red-50 shadow-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  বর্তমান পাতা মুছুন
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Dialog: Insert Table ── */}
      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="font-kalpurush max-w-sm bg-white border border-slate-300">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-indigo-700">
              <TableIcon className="w-5 h-5 text-indigo-600" />
              ছক / টেবিল যোগ করুন
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">সারি (Rows)</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={tableRows}
                  onChange={e => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9 font-bold text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">কলাম (Columns)</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={tableCols}
                  onChange={e => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9 font-bold text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">বর্ডার স্টাইল</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTableBorderType('solid')}
                  className={cn("h-8 text-xs font-bold rounded border transition-all", tableBorderType === 'solid' ? "bg-indigo-50 border-indigo-600 text-indigo-700" : "border-slate-200")}
                >
                  সাধারণ বর্ডার
                </button>
                <button
                  type="button"
                  onClick={() => setTableBorderType('double')}
                  className={cn("h-8 text-xs font-bold rounded border transition-all", tableBorderType === 'double' ? "bg-indigo-50 border-indigo-600 text-indigo-700" : "border-slate-200")}
                >
                  ডাবল বর্ডার
                </button>
                <button
                  type="button"
                  onClick={() => setTableBorderType('dashed')}
                  className={cn("h-8 text-xs font-bold rounded border transition-all", tableBorderType === 'dashed' ? "bg-indigo-50 border-indigo-600 text-indigo-700" : "border-slate-200")}
                >
                  ড্যাশড বর্ডার
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-bold">
              * ইনসার্ট করার পর উপরের 'ছক / টেবিল' মেনু থেকে সারি বা কলাম যোগ/মুছে ফেলতে পারবেন।
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setTableDialogOpen(false)}>
              বাতিল
            </Button>
            <Button size="sm" onClick={() => handleInsertTable(tableRows, tableCols)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              টেবিল তৈরি করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Insert Image ── */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="font-kalpurush max-w-md bg-white border border-slate-300">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-emerald-700">
              <ImageIcon className="w-5 h-5 text-emerald-600" />
              ছবি যোগ করুন
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold">১. ডিভাইস থেকে ছবি আপলোড করুন</Label>
              <input
                type="file"
                ref={imageFileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => imageFileInputRef.current?.click()}
                className="w-full h-10 border-dashed border-2 border-slate-300 hover:border-emerald-500 font-bold text-xs gap-2"
              >
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                ফাইল নির্বাচন করুন (JPG, PNG)
              </Button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-slate-400 text-[10px] font-bold uppercase">অথবা</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">২. ছবির ইন্টারনেট লিংক (URL)</Label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className="h-9 font-bold text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setImageDialogOpen(false)}>
              বাতিল
            </Button>
            <Button 
              size="sm" 
              onClick={handleInsertImageUrl} 
              disabled={!imageUrl.trim()} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              ছবি পেস্ট করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
