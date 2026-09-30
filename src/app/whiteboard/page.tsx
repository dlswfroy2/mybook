
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import './whiteboard.css';

export default function WhiteboardPage() {
  const router = useRouter();
  const [scriptsLoaded, setScriptsLoaded] = useState(0);
  const totalScripts = 7;

  const handleScriptLoad = () => {
    setScriptsLoaded((prev) => prev + 1);
  };

  useEffect(() => {
    if (scriptsLoaded < totalScripts) return;

    // --- Provided JS Logic Adapted for Next.js ---
    const canvas = document.getElementById('board') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const colorPicker = document.getElementById('color') as HTMLInputElement;
    const sizePicker = document.getElementById('size') as HTMLInputElement;
    const fillShapeCheckbox = document.getElementById('fill-shape') as HTMLInputElement;
    const toggleDarkBtn = document.getElementById('toggle-dark')!;
    const clearBtn = document.getElementById('clear')!;

    const undoBtn = document.getElementById('undo-btn')!;
    const redoBtn = document.getElementById('redo-btn')!;
    const zoomInBtn = document.getElementById('zoom-in')!;
    const zoomOutBtn = document.getElementById('zoom-out')!;

    const pdfUpload = document.getElementById('pdf-upload') as HTMLInputElement;
    const uploadBtn = document.getElementById('upload-btn')!;
    const pdfControls = document.getElementById('pdf-controls')!;
    const prevPageBtn = document.getElementById('prev-page')!;
    const nextPageBtn = document.getElementById('next-page')!;
    const pageNumSpan = document.getElementById('page-num')!;
    const saveImgBtn = document.getElementById('save-img')!;
    const savePdfBtn = document.getElementById('save-pdf')!;

    const ruler = document.getElementById('ruler')!;
    const toggleRulerBtn = document.getElementById('toggle-ruler')!;
    const canvasContainer = document.getElementById('canvas-container')!;
    const laserDot = document.getElementById('laser-dot')!;

    const addStickyBtn = document.getElementById('add-sticky')!;
    const speechBtn = document.getElementById('speech-btn')!;
    const recordBtn = document.getElementById('record-btn')!;
    const prevBoardPageBtn = document.getElementById('prev-board-page')!;
    const nextBoardPageBtn = document.getElementById('next-board-page')!;
    const addBoardPageBtn = document.getElementById('add-board-page')!;
    const deleteBoardPageBtn = document.getElementById('delete-board-page')!;
    const boardPageNumSpan = document.getElementById('board-page-num')!;
    const ocrBtn = document.getElementById('ocr-btn')!;

    const modal3D = document.getElementById('modal-3d')!;
    const view3DBtn = document.getElementById('view-3d-btn')!;
    const close3DBtn = document.getElementById('close-3d')!;
    const container3D = document.getElementById('container-3d')!;

    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn')!;
    const toggleRightSidebarBtn = document.getElementById('toggle-right-sidebar-btn')!;
    const toolbar = document.getElementById('toolbar')!;
    const rightToolbar = document.getElementById('right-toolbar')!;
    const scrollWrapper = document.getElementById('scroll-wrapper')!;
    const tabsWrapper = document.getElementById('tabs-wrapper')!;

    const calcBtn = document.getElementById('calc-btn')!;
    const calcWidget = document.getElementById('calc-widget')!;
    const graphBtn = document.getElementById('graph-btn')!;
    const timerBtn = document.getElementById('timer-btn')!;
    const timerWidget = document.getElementById('timer-widget')!;
    const imgBtn = document.getElementById('img-btn')!;
    const imgUpload = document.getElementById('img-upload') as HTMLInputElement;
    const audioBtn = document.getElementById('audio-btn')!;
    const saveSvgBtn = document.getElementById('save-svg')!;
    const saveSessionBtn = document.getElementById('save-session')!;
    const loadSessionBtn = document.getElementById('load-session')!;
    const sessionFile = document.getElementById('session-file') as HTMLInputElement;

    const profileToggleBtn = document.getElementById('profile-toggle-btn')!;
    const profileDropdown = document.getElementById('profile-dropdown')!;
    const chatToggleBtn = document.getElementById('chat-toggle-btn')!;
    const chatWidget = document.getElementById('chat-widget')!;
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;
    const sendChatBtn = document.getElementById('send-chat-btn')!;
    const chatFileInput = document.getElementById('chat-file-input') as HTMLInputElement;
    const chatMessages = document.getElementById('chat-messages')!;

    const resetViewBtn = document.getElementById('reset-view-btn')!;
    const mathToolBtn = document.getElementById('math-tool-btn')!;
    const mathWidget = document.getElementById('math-widget')!;
    const mathLatexInput = document.getElementById('math-latex-input') as HTMLInputElement;
    const mathPreview = document.getElementById('math-preview')!;
    const insertMathBtn = document.getElementById('insert-math-btn')!;
    const spotlightBtn = document.getElementById('spotlight-btn')!;
    const curtainBtn = document.getElementById('curtain-btn')!;
    const fullscreenBtn = document.getElementById('fullscreen-btn')!;
    const presentationCurtain = document.getElementById('presentation-curtain')!;
    const curtainHandle = document.getElementById('curtain-handle')!;
    const spotlightOverlay = document.getElementById('spotlight-overlay')!;
    const syncText = document.getElementById('sync-text')!;

    let currentTool = 'pen';
    let currentBgStyle = 'blank';
    let currentScale = 1;
    let panOffsetX = 0;
    let panOffsetY = 0;
    let isPanning = false;
    let startPanX = 0, startPanY = 0;
    let isDrawing = false;
    let startX: number, startY: number;
    let snapshot: ImageData;
    let currentBoardPage = 0;
    let freehandPoints: {x: number, y: number}[] = [];
    let undoStack: ImageData[] = [];
    let redoStack: ImageData[] = [];
    let drawnObjects: any[] = [];
    const MAX_HISTORY = 20;

    let pagesData: any[] = [{
      imageData: null,
      pdfDoc: null,
      pageNum: 1,
      numPages: 0
    }];

    // Initialize Canvas
    canvas.width = Math.min(window.innerWidth - 60, 2000);
    canvas.height = Math.max(window.innerHeight - 120, 1200);

    function toBengaliNumber(n: number | string | undefined | null): string {
      if (n === undefined || n === null || n === '') return '০';
      const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
      return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
    }

    function saveState() {
      if (undoStack.length >= MAX_HISTORY) undoStack.shift();
      undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      redoStack = [];
      triggerAutoSave();
    }

    function drawBackground() {
      const isDark = document.body.classList.contains('dark-mode');
      ctx.fillStyle = isDark ? '#1a1a1a' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = isDark ? '#333333' : '#e0e0e0';
      ctx.lineWidth = 1;

      if (currentBgStyle === 'grid') {
        for (let x = 0; x < canvas.width; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
        for (let y = 0; y < canvas.height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
      } else if (currentBgStyle === 'graph') {
        for (let x = 0; x < canvas.width; x += 10) {
          ctx.beginPath();
          ctx.strokeStyle = (x % 50 === 0) ? (isDark ? '#555' : '#a2c4c9') : (isDark ? '#252525' : '#e8f4f8');
          ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 10) {
          ctx.beginPath();
          ctx.strokeStyle = (y % 50 === 0) ? (isDark ? '#555' : '#a2c4c9') : (isDark ? '#252525' : '#e8f4f8');
          ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
      } else if (currentBgStyle === 'ruled') {
        for (let y = 40; y < canvas.height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
      }
    }

    function getCanvasCoordinates(e: any) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    function updateCanvasTransform() {
      canvasContainer.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${currentScale})`;
    }

    function triggerAutoSave() {
      if (syncText) syncText.textContent = '💾 সেভ হচ্ছে...';
      setTimeout(() => {
        const autoSaveData = { image: canvas.toDataURL(), bg: currentBgStyle, date: new Date().toISOString() };
        localStorage.setItem('whiteboard_autosave_data', JSON.stringify(autoSaveData));
        if (syncText) syncText.textContent = '☁️ অটো-সেভ সম্পন্ন';
      }, 500);
    }

    // Tools setup
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.getAttribute('data-tool')!;
        if (currentTool === 'pan') canvas.classList.add('panning-active');
        else canvas.classList.remove('panning-active');
      });
    });

    const bgButtons = document.querySelectorAll('.bg-btn');
    bgButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        bgButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBgStyle = btn.getAttribute('data-bg')!;
        saveState();
        drawBackground();
      });
    });

    function startDrawing(e: any) {
      if (currentTool === 'pan' || e.button === 1) {
        isPanning = true;
        startPanX = e.clientX - panOffsetX;
        startPanY = e.clientY - startPanY;
        return;
      }
      if (['laser'].includes(currentTool)) return;
      saveState();
      isDrawing = true;
      const coords = getCanvasCoordinates(e);
      startX = coords.x; startY = coords.y;
      freehandPoints = [{ x: startX, y: startY }];
      ctx.beginPath();
      ctx.lineWidth = Number(sizePicker.value);
      ctx.strokeStyle = colorPicker.value;
      ctx.fillStyle = colorPicker.value;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (['pen', 'eraser', 'highlighter', 'smart-shape'].includes(currentTool)) ctx.moveTo(startX, startY);
    }

    function draw(e: any) {
      if (isPanning) {
        panOffsetX = e.clientX - startPanX;
        panOffsetY = e.clientY - startPanY;
        updateCanvasTransform();
        return;
      }
      const coords = getCanvasCoordinates(e);
      const currentX = coords.x; const currentY = coords.y;
      if (currentTool === 'laser') {
        laserDot.classList.remove('hidden');
        const rect = canvas.getBoundingClientRect();
        (laserDot as HTMLElement).style.left = `${e.clientX - rect.left}px`;
        (laserDot as HTMLElement).style.top = `${e.clientY - rect.top}px`;
        return;
      } else laserDot.classList.add('hidden');
      if (!isDrawing) return;
      if (currentTool === 'pen') {
        ctx.lineTo(currentX, currentY); ctx.stroke();
        freehandPoints.push({ x: currentX, y: currentY });
      } else if (currentTool === 'highlighter') {
        ctx.globalAlpha = 0.3; ctx.lineTo(currentX, currentY); ctx.stroke(); ctx.globalAlpha = 1.0;
      } else if (currentTool === 'eraser') {
        const isDark = document.body.classList.contains('dark-mode');
        ctx.strokeStyle = isDark ? '#1a1a1a' : '#ffffff';
        ctx.lineTo(currentX, currentY); ctx.stroke();
      } else if (currentTool === 'line') {
        ctx.putImageData(snapshot, 0, 0); ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(currentX, currentY); ctx.stroke();
      } else if (currentTool === 'rectangle') {
        ctx.putImageData(snapshot, 0, 0); ctx.beginPath();
        if (fillShapeCheckbox.checked) ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
        ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
      } else if (currentTool === 'circle') {
        ctx.putImageData(snapshot, 0, 0); ctx.beginPath();
        let radius = Math.hypot(startX - currentX, startY - currentY);
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        if (fillShapeCheckbox.checked) ctx.fill(); ctx.stroke();
      }
    }

    function stopDrawing() {
      if (isPanning) { isPanning = false; return; }
      if (!isDrawing) return;
      isDrawing = false; ctx.beginPath();
    }

    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);

    toggleSidebarBtn.addEventListener('click', () => {
      toolbar.classList.toggle('collapsed');
      toggleSidebarBtn.textContent = toolbar.classList.contains('collapsed') ? '▶' : '◀';
    });
    toggleRightSidebarBtn.addEventListener('click', () => {
      rightToolbar.classList.toggle('collapsed');
      toggleRightSidebarBtn.textContent = rightToolbar.classList.contains('collapsed') ? '◀' : '▶';
    });

    clearBtn.addEventListener('click', () => { saveState(); drawBackground(); });
    undoBtn.addEventListener('click', () => {
      if (undoStack.length > 0) {
        redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        ctx.putImageData(undoStack.pop()!, 0, 0);
      }
    });
    redoBtn.addEventListener('click', () => {
      if (redoStack.length > 0) {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        ctx.putImageData(redoStack.pop()!, 0, 0);
      }
    });
    zoomInBtn.addEventListener('click', () => { currentScale += 0.1; updateCanvasTransform(); });
    zoomOutBtn.addEventListener('click', () => { if (currentScale > 0.3) { currentScale -= 0.1; updateCanvasTransform(); } });
    resetViewBtn.addEventListener('click', () => { currentScale = 1; panOffsetX = 0; panOffsetY = 0; updateCanvasTransform(); });

    toggleDarkBtn.addEventListener('click', () => { document.body.classList.toggle('dark-mode'); drawBackground(); });

    drawBackground();

    return () => {
      canvas.removeEventListener('pointerdown', startDrawing);
      canvas.removeEventListener('pointermove', draw);
      canvas.removeEventListener('pointerup', stopDrawing);
    };
  }, [scriptsLoaded]);

  return (
    <div className="whiteboard-body font-kalpurush">
      {/* External Library Scripts */}
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js" onLoad={handleScriptLoad} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js" onLoad={handleScriptLoad} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" onLoad={handleScriptLoad} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" onLoad={handleScriptLoad} />
      <Script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js" onLoad={handleScriptLoad} />
      <Script src="https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js" onLoad={handleScriptLoad} />
      <Script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" onLoad={handleScriptLoad} />

      <div id="browser-tabs-container" className="no-print">
        <div id="tabs-wrapper"></div>
        <button id="add-board-page" className="browser-plus-btn top-plus-btn" title="নতুন পেজ যোগ করুন">➕</button>
        <button id="delete-board-page" className="browser-delete-btn" title="বর্তমান পেজ ডিলিট করুন">🗑️</button>
        <button id="clear">🗑️ মুছুন</button>
        <div id="cloud-sync-status" className="sync-indicator">
          <span id="sync-icon">☁️</span> <span id="sync-text">অটো-সেভ চালুর অপেক্ষায়...</span>
        </div>
        <div id="profile-container">
          <button id="profile-toggle-btn" className="profile-btn">👤 প্রোফাইল</button>
          <div id="profile-dropdown" className="profile-dropdown hidden">
            <div className="profile-header">
              <div className="avatar">👤</div>
              <div>
                <strong id="user-name">ব্যবহারকারী</strong>
                <p id="user-role">শিক্ষক / অ্যাডমিন</p>
              </div>
            </div>
            <hr />
            <button id="chat-toggle-btn" className="profile-menu-btn">💬 লাইভ চ্যাট ও ফাইল শেয়ার</button>
            <button id="my-files-btn" className="profile-menu-btn">📁 সংরক্ষিত সেশনসমূহ</button>
            <button id="logout-btn" className="profile-menu-btn logout">🚪 লগআউট</button>
          </div>
        </div>
      </div>

      <button id="toggle-sidebar-btn" className="sidebar-toggle left-toggle no-print">◀</button>
      <button id="toggle-right-sidebar-btn" className="sidebar-toggle right-toggle no-print">▶</button>

      <div id="toolbar" className="sidebar left-sidebar no-print">
        <label>প্রধান টুলস:</label>
        <div className="tool-group">
          <button type="button" className="tool-btn active" data-tool="pen">✏️ কলম</button>
          <button type="button" className="tool-btn" data-tool="highlighter">🖍️ হাইলাইটার</button>
          <button type="button" className="tool-btn" data-tool="smart-shape">✨ স্মার্ট শেপ</button>
          <button type="button" className="tool-btn" data-tool="select">🎯 অবজেক্ট সিলেক্ট</button>
          <button type="button" className="tool-btn" data-tool="object-eraser">💥 অবজেক্ট ইরেজার</button>
          <button type="button" className="tool-btn" data-tool="pan">✋ প্যান/সরান</button>
        </div>
        <label>মুছা ও পয়েন্টার:</label>
        <div className="tool-group">
          <button type="button" className="tool-btn" data-tool="eraser">🧹 ইরেজার</button>
          <button type="button" className="tool-btn" data-tool="laser">🔴 লেজার ডট</button>
        </div>
        <label>জ্যামিতিক টুলস:</label>
        <div className="tool-group">
          <button type="button" className="tool-btn" data-tool="line">📏 লাইন</button>
          <button type="button" className="tool-btn" data-tool="rectangle">⬛ আয়তক্ষেত্র</button>
          <button type="button" className="tool-btn" data-tool="circle">⭕ বৃত্ত</button>
          <button type="button" className="tool-btn" data-tool="text">🔤 টেক্সট</button>
        </div>
        <hr style={{ width: '100%', border: '1px solid #ffffff55' }} />
        <label>কালার:</label>
        <input type="color" id="color" defaultValue="#000000" />
        <label>তুলির সাইজ:</label>
        <input type="range" id="size" min="1" max="50" defaultValue="5" />
        <label><input type="checkbox" id="fill-shape" /> শেপ ফিল</label>
      </div>

      <div id="right-toolbar" className="sidebar right-sidebar no-print">
        <label>ব্যাকগ্রাউন্ড:</label>
        <div className="bg-btn-group">
          <button type="button" className="bg-btn active" data-bg="blank">⬜ খালি</button>
          <button type="button" className="bg-btn" data-bg="grid">▦ গ্রিড</button>
          <button type="button" className="bg-btn" data-bg="graph">📈 গ্রাফ</button>
          <button type="button" className="bg-btn" data-bg="ruled">≡ রুল</button>
        </div>
        <button id="toggle-dark">🌙 ডার্ক মোড</button>
        <div id="page-controls">
          <span id="board-page-num">পেজ: ১/১</span>
          <button id="prev-board-page">⬅️ আগে</button>
          <button id="next-board-page">➡️ পরে</button>
        </div>
        <button id="undo-btn">↩️ আনডু</button>
        <button id="redo-btn">↪️ রিডু</button>
        <button id="zoom-in">🔍 জুম ইন</button>
        <button id="zoom-out">🔎 জুম আউট</button>
        <button id="reset-view-btn">🎯 ভিউ রিসেট</button>
        <button id="add-sticky">📌 স্টিকি নোট</button>
        <button id="ocr-btn">📝 OCR রিড</button>
        <button id="math-tool-btn">∑</math LaTeX</button>
        <button id="calc-btn">🧮 ক্যালকুলেটর</button>
        <button id="timer-btn">⏱️ টাইমার</button>
        <input type="file" id="pdf-upload" accept="application/pdf" style={{ display: 'none' }} />
        <button id="upload-btn">📂 PDF আপলোড</button>
        <button id="save-img">💾 ছবি সেভ</button>
        <button id="save-pdf">📄 PDF সেভ</button>
      </div>

      <div id="scroll-wrapper">
        <div id="canvas-container">
          <canvas id="board"></canvas>
          <div id="laser-dot" className="hidden"></div>
          <div id="minimap" className="hidden">
            <div id="minimap-viewport"></div>
          </div>
          <div id="presentation-curtain" className="hidden">
            <div id="curtain-handle">🚪 পর্দা</div>
          </div>
          <div id="spotlight-overlay" className="hidden"></div>
        </div>
      </div>

      <div id="modal-3d" className="hidden">
        <div className="modal-content">
          <span id="close-3d">&times;</span>
          <div id="container-3d"></div>
        </div>
      </div>

      <div id="calc-widget" className="widget hidden">
        <div className="widget-header">🧮 ক্যালকুলেটর <span className="close-widget">&times;</span></div>
        <input type="text" id="calc-screen" readOnly />
        <div className="calc-buttons">
          <button>7</button><button>8</button><button>9</button><button>/</button>
          <button>4</button><button>5</button><button>6</button><button>*</button>
          <button>1</button><button>2</button><button>3</button><button>-</button>
          <button>0</button><button>.</button><button>=</button><button>+</button>
        </div>
      </div>

      <div id="math-widget" className="widget hidden">
        <div className="widget-header">∑ ম্যাথ ইনপুট <span className="close-widget">&times;</span></div>
        <input type="text" id="math-latex-input" placeholder="LaTeX..." style={{ width: '100%' }} />
        <div id="math-preview" style={{ background: '#fff', color: '#000', padding: '10px', minHeight: '40px', marginTop: '5px' }}></div>
        <button id="insert-math-btn" style={{ width: '100%', marginTop: '5px' }}>যোগ করুন</button>
      </div>

      <div id="timer-widget" className="widget hidden">
        <div className="widget-header">⏱️ টাইমার <span className="close-widget">&times;</span></div>
        <div id="timer-display">00:00</div>
        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
          <button id="start-timer">শুরু</button>
          <button id="stop-timer">বন্ধ</button>
          <button id="reset-timer">রিসেট</button>
        </div>
      </div>

      <button className="back-home-btn no-print" onClick={() => router.push('/')}>
        <ArrowLeft className="w-4 h-4" /> পোর্টালে ফিরুন
      </button>

      <input type="file" id="img-upload" accept="image/*" style={{ display: 'none' }} />
      <input type="file" id="session-file" accept=".json" style={{ display: 'none' }} />
    </div>
  );
}
