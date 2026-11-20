"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Superscript, 
  Subscript, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  Palette, 
  Highlighter, 
  Plus, 
  Minus, 
  Indent, 
  Outdent, 
  Square, 
  RemoveFormatting, 
  ChevronDown 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FloatingSelectionToolbarProps {
  onSync?: () => void;
}

const FONT_FAMILIES = [
  { label: 'কালপুরুষ', value: "'Kalpurush', sans-serif" },
  { label: 'সোলাইমান লিপি', value: "'SolaimanLipi', sans-serif" },
  { label: 'সুতোন্নীএমজে', value: "'SutonnyMJ', sans-serif" },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
];

const QUICK_COLORS = [
  { label: 'কালো', value: '#000000' },
  { label: 'গাঢ় নীল', value: '#1e3a8a' },
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
  { label: 'মুছুন', value: 'transparent' },
];

export function FloatingSelectionToolbar({ onSync }: FloatingSelectionToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [currentSize, setCurrentSize] = useState<number>(10.5);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  // Apply styling to range
  const applyInlineStyle = (styler: (span: HTMLElement) => void) => {
    const sel = window.getSelection();
    let range = (sel && sel.rangeCount > 0 && !sel.isCollapsed) ? sel.getRangeAt(0) : savedRangeRef.current;
    if (!range || range.collapsed) return;

    try {
      const span = document.createElement('span');
      styler(span);
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);

      // Re-select newly styled span
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel?.removeAllRanges();
      sel?.addRange(newRange);
      savedRangeRef.current = newRange;

      span.closest('.content-area')?.dispatchEvent(new Event('input', { bubbles: true }));
      if (onSync) onSync();
    } catch (e) {
      console.warn('Floating toolbar applyInlineStyle error:', e);
    }
  };

  const exec = (cmd: string, val: string = '') => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      if (savedRangeRef.current) {
        sel?.removeAllRanges();
        sel?.addRange(savedRangeRef.current);
      }
    }
    try {
      document.execCommand(cmd, false, val);
      const activeEl = document.querySelector('.content-area:focus') || document.querySelector('.content-area');
      activeEl?.dispatchEvent(new Event('input', { bubbles: true }));
      if (onSync) onSync();
    } catch (e) {
      console.warn('execCommand failed:', cmd, e);
    }
  };

  // Font size handlers
  const adjustFontSize = (delta: number) => {
    const next = Math.max(6, Math.min(72, Math.round((currentSize + delta) * 2) / 2));
    setCurrentSize(next);
    applyInlineStyle(span => { span.style.fontSize = `${next}pt`; });
  };

  const setExactFontSize = (pt: number) => {
    setCurrentSize(pt);
    applyInlineStyle(span => { span.style.fontSize = `${pt}pt`; });
  };

  // Align current selected block / line
  const alignBlock = (align: 'left' | 'center' | 'right' | 'justify') => {
    const sel = window.getSelection();
    const range = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0) : savedRangeRef.current;
    if (!range) return;

    let node: Node | null = range.startContainer;
    while (node && !node.parentElement?.classList?.contains('content-area')) {
      if (node.nodeType === Node.ELEMENT_NODE && /^(P|H[1-6]|DIV|LI)$/i.test((node as HTMLElement).tagName)) {
        break;
      }
      node = node.parentNode;
    }
    if (node && node.nodeType === Node.ELEMENT_NODE) {
      (node as HTMLElement).style.textAlign = align;
      (node as HTMLElement).closest('.content-area')?.dispatchEvent(new Event('input', { bubbles: true }));
      if (onSync) onSync();
    } else {
      exec(`justify${align.charAt(0).toUpperCase() + align.slice(1)}`);
    }
  };

  // Indent selected block
  const adjustIndent = (deltaInches: number) => {
    const sel = window.getSelection();
    const range = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0) : savedRangeRef.current;
    if (!range) return;

    let node: Node | null = range.startContainer;
    while (node && !node.parentElement?.classList?.contains('content-area')) {
      if (node.nodeType === Node.ELEMENT_NODE && /^(P|H[1-6]|DIV|LI)$/i.test((node as HTMLElement).tagName)) {
        break;
      }
      node = node.parentNode;
    }
    if (node && node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const current = parseFloat(el.style.marginLeft || '0') || 0;
      const next = Math.max(0, current + deltaInches);
      el.style.marginLeft = next > 0 ? `${next}in` : '';
      el.closest('.content-area')?.dispatchEvent(new Event('input', { bubbles: true }));
      if (onSync) onSync();
    }
  };

  // Wrap in a neat box border (Word Callout / Box layout)
  const toggleBoxBorder = () => {
    const sel = window.getSelection();
    const range = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0) : savedRangeRef.current;
    if (!range) return;

    let node: Node | null = range.startContainer;
    while (node && !node.parentElement?.classList?.contains('content-area')) {
      if (node.nodeType === Node.ELEMENT_NODE && /^(P|H[1-6]|DIV|LI)$/i.test((node as HTMLElement).tagName)) {
        break;
      }
      node = node.parentNode;
    }

    if (node && node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.style.border && el.style.border !== 'none') {
        el.style.border = '';
        el.style.padding = '';
        el.style.backgroundColor = '';
        el.style.borderRadius = '';
      } else {
        el.style.border = '1.5px solid #1e293b';
        el.style.padding = '8px 12px';
        el.style.backgroundColor = '#f8fafc';
        el.style.borderRadius = '6px';
      }
      el.closest('.content-area')?.dispatchEvent(new Event('input', { bubbles: true }));
      if (onSync) onSync();
    }
  };

  // Track selection inside any .content-area
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setVisible(false);
        setShowColorPicker(false);
        setShowHighlightPicker(false);
        setShowFontPicker(false);
        return;
      }

      const range = sel.getRangeAt(0);
      const text = sel.toString().trim();
      if (!text) {
        setVisible(false);
        return;
      }

      // Ensure the selection is inside a .content-area
      let container: Node | null = range.commonAncestorContainer;
      let isInContentArea = false;
      while (container) {
        if (container.nodeType === Node.ELEMENT_NODE && (container as HTMLElement).classList?.contains('content-area')) {
          isInContentArea = true;
          break;
        }
        container = container.parentNode;
      }

      if (!isInContentArea) {
        setVisible(false);
        return;
      }

      savedRangeRef.current = range.cloneRange();

      // Read font size at cursor
      let elNode: HTMLElement | null = range.startContainer.nodeType === Node.ELEMENT_NODE 
        ? range.startContainer as HTMLElement 
        : range.startContainer.parentElement;
      if (elNode) {
        const computed = window.getComputedStyle(elNode);
        const px = parseFloat(computed.fontSize);
        if (px) setCurrentSize(Math.round(px * 0.75 * 10) / 10);
      }

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setVisible(false);
        return;
      }

      // Calculate position above selection
      const toolbarHeight = 44;
      let top = rect.top - toolbarHeight - 8;
      if (top < 10) {
        // If too close to viewport top, show below selection
        top = rect.bottom + 8;
      }

      const screenW = typeof window !== 'undefined' ? window.innerWidth : 800;
      const toolbarWidth = Math.min(460, screenW - 20);
      let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);
      if (left < 10) left = 10;
      if (left + toolbarWidth > screenW - 10) {
        left = Math.max(10, screenW - toolbarWidth - 10);
      }

      setCoords({ top, left });
      setVisible(true);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      onMouseDown={e => e.preventDefault()} // Prevent losing selection
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 999999,
      }}
      className="no-print bg-slate-900/95 backdrop-blur-md text-white px-2 py-1.5 rounded-xl shadow-2xl border border-slate-700/80 flex items-center gap-1 font-kalpurush select-none animate-in fade-in zoom-in-95 duration-150 max-w-[calc(100vw-20px)] overflow-x-auto no-scrollbar touch-manipulation"
    >
      {/* Font Family Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowFontPicker(!showFontPicker);
            setShowColorPicker(false);
            setShowHighlightPicker(false);
          }}
          className="h-7 px-2 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 rounded flex items-center gap-1 border border-slate-700 text-slate-200"
          title="ফন্ট নির্বাচন"
        >
          <span>ফন্ট</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        {showFontPicker && (
          <div className="absolute top-8 left-0 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1 w-36 z-50 flex flex-col gap-0.5">
            {FONT_FAMILIES.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  applyInlineStyle(span => { span.style.fontFamily = f.value; });
                  setShowFontPicker(false);
                }}
                className="text-left px-2 py-1 text-xs hover:bg-indigo-600 rounded text-slate-200 font-bold"
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

      {/* Font Size +/- */}
      <div className="flex items-center bg-slate-800 rounded border border-slate-700 p-0.5">
        <button
          type="button"
          onClick={() => adjustFontSize(-0.5)}
          className="w-5 h-6 hover:bg-slate-700 rounded flex items-center justify-center font-bold text-xs"
          title="ফন্ট ছোট করুন"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="px-1.5 text-xs font-bold text-emerald-400 min-w-[28px] text-center">
          {currentSize}
        </span>
        <button
          type="button"
          onClick={() => adjustFontSize(0.5)}
          className="w-5 h-6 hover:bg-slate-700 rounded flex items-center justify-center font-bold text-xs"
          title="ফন্ট বড় করুন"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

      {/* Basic Formatting: Bold, Italic, Underline, Strikethrough */}
      <button
        type="button"
        onClick={() => exec('bold')}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="বোল্ড (Ctrl+B)"
      >
        <Bold className="w-3.5 h-3.5 font-bold" />
      </button>

      <button
        type="button"
        onClick={() => exec('italic')}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="ইটালিক (Ctrl+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => exec('underline')}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="আন্ডারলাইন (Ctrl+U)"
      >
        <Underline className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => exec('strikeThrough')}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="স্ট্রাইকথ্রু"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>

      <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

      {/* Subscript / Superscript */}
      <button
        type="button"
        onClick={() => exec('superscript')}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="পাওয়ার / সুপারস্ক্রিপ্ট (X²)"
      >
        <Superscript className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => exec('subscript')}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="সাবস্ক্রিপ্ট (X₁)"
      >
        <Subscript className="w-3.5 h-3.5" />
      </button>

      <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

      {/* Text Color Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowColorPicker(!showColorPicker);
            setShowHighlightPicker(false);
            setShowFontPicker(false);
          }}
          className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
          title="টেক্সট কালার / অক্ষরের রং"
        >
          <Palette className="w-3.5 h-3.5 text-amber-400" />
        </button>

        {showColorPicker && (
          <div className="absolute top-8 left-0 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2 z-50 flex gap-1.5">
            {QUICK_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  applyInlineStyle(span => { span.style.color = c.value; });
                  setShowColorPicker(false);
                }}
                style={{ backgroundColor: c.value }}
                className="w-5 h-5 rounded-full border border-white/40 hover:scale-125 transition-transform"
                title={c.label}
              />
            ))}
          </div>
        )}
      </div>

      {/* Highlight Color Picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowHighlightPicker(!showHighlightPicker);
            setShowColorPicker(false);
            setShowFontPicker(false);
          }}
          className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
          title="হাইলাইট মার্কার"
        >
          <Highlighter className="w-3.5 h-3.5 text-yellow-300" />
        </button>

        {showHighlightPicker && (
          <div className="absolute top-8 left-0 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2 z-50 flex gap-1.5">
            {HIGHLIGHT_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  applyInlineStyle(span => { span.style.backgroundColor = c.value; });
                  setShowHighlightPicker(false);
                }}
                style={{ backgroundColor: c.value === 'transparent' ? '#334155' : c.value }}
                className="w-5 h-5 rounded border border-white/40 hover:scale-125 transition-transform flex items-center justify-center text-[10px]"
                title={c.label}
              >
                {c.value === 'transparent' ? '✕' : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

      {/* Alignment */}
      <button
        type="button"
        onClick={() => alignBlock('left')}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="বামে সারিবদ্ধ"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => alignBlock('center')}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="মাঝখানে সারিবদ্ধ"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => alignBlock('justify')}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="জাস্টিফাই / উভয় পাশ সমান"
      >
        <AlignJustify className="w-3.5 h-3.5" />
      </button>

      <div className="h-4 w-[1px] bg-slate-700 mx-0.5" />

      {/* Indent / Outdent */}
      <button
        type="button"
        onClick={() => adjustIndent(-0.25)}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="বামে সরান (Outdent)"
      >
        <Outdent className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => adjustIndent(0.25)}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="ডানে সরান (Indent)"
      >
        <Indent className="w-3.5 h-3.5" />
      </button>

      {/* Box Border Toggle */}
      <button
        type="button"
        onClick={toggleBoxBorder}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-slate-200 hover:text-white"
        title="বক্সে রূপান্তর / বর্ডার দিন"
      >
        <Square className="w-3.5 h-3.5 text-cyan-400" />
      </button>

      {/* Remove Formatting */}
      <button
        type="button"
        onClick={() => exec('removeFormat')}
        className="w-7 h-7 hover:bg-slate-800 rounded flex items-center justify-center text-rose-300 hover:text-rose-100"
        title="ফরম্যাটিং মুছুন / স্বাভাবিক করুন"
      >
        <RemoveFormatting className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
