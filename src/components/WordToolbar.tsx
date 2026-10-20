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
  Type
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  className?: string;
}

export function WordToolbar({
  onAddPage,
  onDeletePage,
  activePageIndex = 0,
  totalPages = 1,
  zoomLevel = 100,
  onZoomChange,
  className
}: WordToolbarProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'insert' | 'layout'>('home');
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
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
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
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
      if (lastNode) {
        const newRange = range.cloneRange();
        newRange.setStartAfter(lastNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    } else {
      // Fallback: append to currently active editable area
      const activeEl = document.querySelector('.content-area:focus') || 
                       document.querySelector('.paper.ring-4 .content-area') ||
                       document.querySelector('.content-area');
      if (activeEl) {
        activeEl.innerHTML += html;
      }
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

  // Quick Colors
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

  // Callout Boxes
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
  ];

  // Insert Table
  const handleInsertTable = () => {
    let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 1.5px solid #000; font-size: inherit;">\n<tbody>\n`;
    for (let r = 0; r < tableRows; r++) {
      tableHtml += `  <tr>\n`;
      for (let c = 0; c < tableCols; c++) {
        const isHeader = r === 0;
        tableHtml += `    <td style="border: 1px solid #000; padding: 6px 10px; ${isHeader ? 'background-color: #f1f5f9; font-weight: bold; text-align: center;' : ''}">` +
                     (isHeader ? `কলাম ${c + 1}` : `ডাটা`) +
                     `</td>\n`;
      }
      tableHtml += `  </tr>\n`;
    }
    tableHtml += `</tbody>\n</table>\n<p><br/></p>`;
    insertHtmlAtCursor(tableHtml);
    setTableDialogOpen(false);
  };

  // Insert Callout Box
  const handleInsertCallout = (box: typeof CALLOUT_BOXES[0]) => {
    const boxHtml = `
      <div style="border-left: 4px solid ${box.border}; background-color: ${box.bg}; padding: 10px 14px; margin: 10px 0; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
        <p style="margin: 0; font-weight: bold; color: ${box.border}; display: flex; align-items: center; gap: 6px;">
          <span>${box.icon}</span> <span>${box.label}</span>
        </p>
        <p style="margin: 4px 0 0 0; color: #1e293b;">এখানে বিবরণ বা টেক্সট লিখুন...</p>
      </div>
      <p><br/></p>
    `;
    insertHtmlAtCursor(boxHtml);
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
      // Apply to active editable
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
              {/* Font Color Dropdown */}
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

              {/* Highlight Color Dropdown */}
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
            {/* Insert Table Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setTableDialogOpen(true)}
              className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 shadow-xs"
            >
              <TableIcon className="w-4 h-4 text-indigo-600" />
              ছক / টেবিল যোগ করুন
            </Button>

            {/* Insert Image Button */}
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

            {/* Horizontal Line */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseDown={e => e.preventDefault()}
              onClick={() => insertHtmlAtCursor('<hr style="border: none; border-top: 1.5px solid #000; margin: 12px 0;" /><p><br/></p>')}
              className="h-8 gap-1.5 font-bold text-xs bg-white border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 shadow-xs"
            >
              <Minus className="w-4 h-4" />
              বিভাজক রেখা
            </Button>

            {/* Callout Box Dropdown */}
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
                  নোট বক্স / বিশেষ দ্রষ্টব্য
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

            {/* Math & Special Symbols Palette Dropdown */}
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
                  প্রতীক ও গাণিতিক চিহ্ন
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
          </>
        )}

        {/* ═══════════ TAB 3: PAGE LAYOUT (পেজ লেআউট) ═══════════ */}
        {activeTab === 'layout' && (
          <>
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
                নতুন পাতা যোগ করুন
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

            <div className="text-xs text-slate-500 font-bold ml-2">
              💡 পেজের মার্জিন, সাইজ এবং জলছাপ পরিবর্তন করতে বামপাশের সাইডবার ব্যবহার করুন।
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
            <p className="text-[11px] text-slate-500 font-bold">
              * তৈরি হওয়ার পর টেবিলে ক্লিক করে সরাসরি যেকোনো তথ্য লিখতে পারবেন।
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setTableDialogOpen(false)}>
              বাতিল
            </Button>
            <Button size="sm" onClick={handleInsertTable} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
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
