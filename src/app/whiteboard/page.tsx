'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { ArrowLeft, XCircle, BrainCircuit, Sparkles, Copy, Check, CheckCircle2 } from 'lucide-react';
import { performWhiteboardVisionOcr, solveWhiteboardProblem, generateWhiteboardDiagram } from '@/ai/flows/whiteboard-solver-flow';
import './whiteboard.css';

export default function WhiteboardPage() {
  const router = useRouter();
  const [scriptsLoaded, setScriptsLoaded] = useState(0);
  const isInitialized = useRef(false);

  const handleScriptLoad = () => {
    setScriptsLoaded((prev) => prev + 1);
  };

  useEffect(() => {
    if (isInitialized.current) return;

    const canvas = document.getElementById('board') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const colorPicker = document.getElementById('color') as HTMLInputElement;
    const sizePicker = document.getElementById('size') as HTMLInputElement;
    const fillShapeCheckbox = document.getElementById('fill-shape') as HTMLInputElement;
    const toggleDarkBtn = document.getElementById('toggle-dark')!;
    const clearBtn = document.getElementById('clear')!;

    const undoBtn = document.getElementById('undo-btn')!;
    const redoBtn = document.getElementById('redo-btn')!;
    const zoomInBtn = document.getElementById('zoom-in')!;
    const zoomOutBtn = document.getElementById('zoom-out')!;
    const resetViewBtn = document.getElementById('reset-view-btn')!;

    const pdfUpload = document.getElementById('pdf-upload') as HTMLInputElement;
    const uploadBtn = document.getElementById('upload-btn')!;
    const imgUpload = document.getElementById('img-upload') as HTMLInputElement;
    const imgUploadBtn = document.getElementById('img-upload-btn');
    const pdfControls = document.getElementById('pdf-controls')!;
    const prevPageBtn = document.getElementById('prev-page')!;
    const nextPageBtn = document.getElementById('next-page')!;
    const pageNumSpan = document.getElementById('page-num')!;
    const saveImgBtn = document.getElementById('save-img')!;
    const savePdfBtn = document.getElementById('save-pdf')!;

    const canvasContainer = document.getElementById('canvas-container')!;
    const laserDot = document.getElementById('laser-dot')!;

    const addStickyBtn = document.getElementById('add-sticky')!;
    const addBoardPageBtn = document.getElementById('add-board-page')!;
    const deleteBoardPageBtn = document.getElementById('delete-board-page')!;
    const boardPageNumSpan = document.getElementById('board-page-num')!;
    const ocrBtn = document.getElementById('ocr-btn')!;

    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn')!;
    const toggleRightSidebarBtn = document.getElementById('toggle-right-sidebar-btn')!;
    const toolbar = document.getElementById('toolbar')!;
    const rightToolbar = document.getElementById('right-toolbar')!;
    const tabsWrapper = document.getElementById('tabs-wrapper')!;

    const calcBtn = document.getElementById('calc-btn')!;
    const calcWidget = document.getElementById('calc-widget')!;
    const timerBtn = document.getElementById('timer-btn')!;
    const timerWidget = document.getElementById('timer-widget')!;
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

    const speechBtn = document.getElementById('speech-btn')!;
    const recordBtn = document.getElementById('record-btn')!;

    const aiSolveBtn = document.getElementById('ai-solve-btn')!;
    const aiModal = document.getElementById('ai-modal')!;
    const aiModalTitle = document.getElementById('ai-modal-title')!;
    const aiBody = document.getElementById('ai-solution-body')!;
    const closeAiBtn = document.getElementById('close-ai-modal')!;

    const aiDrawBtn = document.getElementById('ai-draw-btn')!;
    const aiDrawWidget = document.getElementById('ai-draw-widget')!;

    let currentTool = 'pen';
    let currentBgStyle = 'blank';
    let currentScale = 1;
    let panOffsetX = 0;
    let panOffsetY = 0;
    let isPanning = false;
    let startPanX = 0, startPanY = 0;
    let isDrawing = false;
    let startX: number, startY: number;
    let currentX: number, currentY: number;
    let snapshot: ImageData;
    let freehandPoints: {x: number, y: number}[] = [];
    let undoStack: ImageData[] = [];
    let redoStack: ImageData[] = [];
    const MAX_HISTORY = 25;

    let pagesData: any[] = [{
      imageData: null,
      pdfDoc: null,
      pageNum: 1,
      numPages: 0
    }];
    let currentBoardPage = 0;

    const sidebarsWidth = 380;
    canvas.width = Math.max(900, window.innerWidth - sidebarsWidth);
    canvas.height = 3000;

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
      } else if (currentBgStyle === 'isometric') {
        const side = 30;
        const h = side * Math.sqrt(3) / 2;
        for (let y = 0; y < canvas.height + h; y += h) {
          for (let x = 0; x < canvas.width + side; x += side * 1.5) {
            ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = isDark ? '#555' : '#aaa'; ctx.fill();
          }
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
        try {
          const autoSaveData = { image: canvas.toDataURL(), bg: currentBgStyle, date: new Date().toISOString() };
          localStorage.setItem('whiteboard_autosave_data', JSON.stringify(autoSaveData));
          if (syncText) syncText.textContent = '☁️ অটো-সেভ সম্পন্ন';
        } catch (e) {
          if (syncText) syncText.textContent = '☁️ সেভ হয়েছে';
        }
      }, 500);
    }

    function detectAndDrawSmartShape(points: {x: number, y: number}[]) {
        if (points.length < 10) return;
        const first = points[0];
        const last = points[points.length - 1];
        const dist = Math.hypot(last.x - first.x, last.y - first.y);

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(p => {
          if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        });

        const width = maxX - minX;
        const height = maxY - minY;

        ctx.beginPath();
        ctx.lineWidth = Number(sizePicker.value);
        ctx.strokeStyle = colorPicker.value;

        if (dist < 40) { 
          if (Math.abs(width - height) < 20) {
            ctx.arc(minX + width / 2, minY + height / 2, Math.max(width, height) / 2, 0, Math.PI * 2);
          } else {
            ctx.rect(minX, minY, width, height);
          }
        } else { 
          ctx.moveTo(first.x, first.y);
          ctx.lineTo(last.x, last.y);
        }
        ctx.stroke();
    }

    function drawProtractor() {
        saveState();
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 150;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 235, 59, 0.4)';
        ctx.fill();
        ctx.strokeStyle = '#d35400';
        ctx.lineWidth = 3;
        ctx.stroke();

        for (let i = 0; i <= 180; i += 10) { 
          const angle = (i * Math.PI) / 180;
          const x1 = centerX - radius * Math.cos(angle);
          const y1 = centerY - radius * Math.sin(angle);
          const x2 = centerX - (radius - 15) * Math.cos(angle);
          const y2 = centerY - (radius - 15) * Math.sin(angle);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
    }

    function drawCompass() {
        saveState();
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 100;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#e74c3c';
        ctx.fill();
    }

    function handleDirectText(e: any) {
        const coords = getCanvasCoordinates(e);
        const clickX = coords.x;
        const clickY = coords.y;

        const existingInput = document.querySelector('.canvas-text-input');
        if (existingInput) existingInput.remove();

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'canvas-text-input';
        const fontSize = Math.max(16, Number(sizePicker.value) * 3);
        
        const rect = canvas.getBoundingClientRect();
        input.style.fontSize = `${fontSize}px`;
        input.style.color = colorPicker.value;
        input.style.left = `${e.clientX - rect.left}px`;
        input.style.top = `${e.clientY - rect.top - fontSize / 2}px`;
        input.style.position = 'absolute';
        input.style.zIndex = '1000';
        input.style.background = 'transparent';
        input.style.border = '2px dashed #3498db';
        input.style.outline = 'none';

        canvasContainer.appendChild(input);
        setTimeout(() => input.focus(), 10);

        const finalize = () => {
            const text = input.value.trim();
            if (text) {
                saveState();
                ctx.font = `${fontSize}px Kalpurush, sans-serif`;
                ctx.fillStyle = input.style.color;
                ctx.textBaseline = 'middle';
                ctx.fillText(text, clickX, clickY);
            }
            input.remove();
        };

        input.addEventListener('keydown', (evt) => { if (evt.key === 'Enter') finalize(); });
        input.addEventListener('blur', finalize);
    }

    const toolBtnHandler = (e: Event) => {
        const btn = e.currentTarget as HTMLElement;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.getAttribute('data-tool')!;
        if (currentTool === 'pan') canvas.classList.add('panning-active');
        else canvas.classList.remove('panning-active');
        
        if (currentTool === 'protractor') drawProtractor();
        if (currentTool === 'compass') drawCompass();
    };
    document.querySelectorAll('.tool-btn').forEach(btn => btn.addEventListener('click', toolBtnHandler));

    const bgBtnHandler = (e: Event) => {
        const btn = e.currentTarget as HTMLElement;
        document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBgStyle = btn.getAttribute('data-bg')!;
        saveState();
        drawBackground();
    };
    document.querySelectorAll('.bg-btn').forEach(btn => btn.addEventListener('click', bgBtnHandler));

    function startDrawing(e: any) {
      if (currentTool === 'pan' || e.button === 1) {
        isPanning = true;
        startPanX = e.clientX - panOffsetX;
        startPanY = e.clientY - panOffsetY;
        return;
      }
      if (['laser', 'protractor', 'compass'].includes(currentTool)) return;
      if (currentTool === 'text') { handleDirectText(e); return; }

      saveState();
      isDrawing = true;
      const coords = getCanvasCoordinates(e);
      startX = coords.x; startY = coords.y;
      currentX = startX; currentY = startY;
      freehandPoints = [{ x: startX, y: startY }];
      ctx.beginPath();
      
      const brushSize = Number(sizePicker.value);
      ctx.lineWidth = currentTool === 'eraser' ? Math.max(25, brushSize * 4) : brushSize;
      
      const isDark = document.body.classList.contains('dark-mode');
      if (currentTool === 'eraser') {
        ctx.strokeStyle = isDark ? '#1a1a1a' : '#ffffff';
      } else {
        ctx.strokeStyle = colorPicker.value;
      }
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
      currentX = coords.x; currentY = coords.y;
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
      } else if (currentTool === 'area-eraser') {
        ctx.putImageData(snapshot, 0, 0);
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        ctx.setLineDash([]);
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
      } else if (currentTool === 'triangle') {
        ctx.putImageData(snapshot, 0, 0); ctx.beginPath();
        ctx.moveTo(startX + (currentX - startX) / 2, startY);
        ctx.lineTo(startX, currentY); ctx.lineTo(currentX, currentY); ctx.closePath();
        if (fillShapeCheckbox.checked) ctx.fill(); ctx.stroke();
      } else if (currentTool === 'right-triangle') {
        ctx.putImageData(snapshot, 0, 0); ctx.beginPath();
        ctx.moveTo(startX, startY); ctx.lineTo(startX, currentY); ctx.lineTo(currentX, currentY); ctx.closePath();
        if (fillShapeCheckbox.checked) ctx.fill(); ctx.stroke();
      } else if (currentTool === 'diamond') {
        ctx.putImageData(snapshot, 0, 0); ctx.beginPath();
        let w = currentX - startX, h = currentY - startY;
        ctx.moveTo(startX + w / 2, startY); ctx.lineTo(startX + w, startY + h / 2);
        ctx.lineTo(startX + w / 2, startY + h); ctx.lineTo(startX, startY + h / 2); ctx.closePath();
        if (fillShapeCheckbox.checked) ctx.fill(); ctx.stroke();
      } else if (currentTool === 'star') {
        ctx.putImageData(snapshot, 0, 0); ctx.beginPath();
        let r = Math.hypot(startX - currentX, startY - currentY);
        let rot = Math.PI / 2 * 3, step = Math.PI / 5;
        ctx.moveTo(startX, startY - r);
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(startX + Math.cos(rot) * r, startY + Math.sin(rot) * r); rot += step;
          ctx.lineTo(startX + Math.cos(rot) * (r / 2), startY + Math.sin(rot) * (r / 2)); rot += step;
        }
        ctx.closePath();
        if (fillShapeCheckbox.checked) ctx.fill(); ctx.stroke();
      }
    }

    function stopDrawing() {
      if (isPanning) { isPanning = false; return; }
      if (!isDrawing) return;
      if (currentTool === 'smart-shape') { ctx.putImageData(snapshot, 0, 0); detectAndDrawSmartShape(freehandPoints); }
      if (currentTool === 'area-eraser') {
        ctx.putImageData(snapshot, 0, 0);
        const isDark = document.body.classList.contains('dark-mode');
        ctx.fillStyle = isDark ? '#1a1a1a' : '#ffffff';
        ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
      }
      isDrawing = false; ctx.beginPath();
    }

    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);

    const adjustScrollWrapperLayout = () => {
      const leftCol = toolbar.classList.contains('collapsed');
      const rightCol = rightToolbar.classList.contains('collapsed');
      const scrollWrapper = document.getElementById('scroll-wrapper');
      if (scrollWrapper) {
        scrollWrapper.style.left = leftCol ? '35px' : '180px';
        scrollWrapper.style.right = rightCol ? '35px' : '175px';
      }
    };

    const toggleSidebarHandler = () => {
      toolbar.classList.toggle('collapsed');
      toggleSidebarBtn.textContent = toolbar.classList.contains('collapsed') ? '▶' : '◀';
      adjustScrollWrapperLayout();
    };
    toggleSidebarBtn.addEventListener('click', toggleSidebarHandler);

    const toggleRightSidebarHandler = () => {
      rightToolbar.classList.toggle('collapsed');
      toggleRightSidebarBtn.textContent = rightToolbar.classList.contains('collapsed') ? '◀' : '▶';
      adjustScrollWrapperLayout();
    };
    toggleRightSidebarBtn.addEventListener('click', toggleRightSidebarHandler);

    adjustScrollWrapperLayout();

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) currentScale = Math.min(3, currentScale + 0.1);
        else if (currentScale > 0.3) currentScale = Math.max(0.3, currentScale - 0.1);
        updateCanvasTransform();
      } else {
        const scrollWrapper = document.getElementById('scroll-wrapper');
        if (scrollWrapper) {
          scrollWrapper.scrollTop += e.deltaY;
          if (e.deltaX) scrollWrapper.scrollLeft += e.deltaX;
        }
      }
    }, { passive: false });

    clearBtn.onclick = () => { saveState(); drawBackground(); };
    undoBtn.onclick = () => {
      if (undoStack.length > 0) {
        redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        ctx.putImageData(undoStack.pop()!, 0, 0);
      }
    };
    redoBtn.onclick = () => {
      if (redoStack.length > 0) {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        ctx.putImageData(redoStack.pop()!, 0, 0);
      }
    };
    zoomInBtn.onclick = () => { currentScale += 0.1; updateCanvasTransform(); };
    zoomOutBtn.onclick = () => { if (currentScale > 0.3) { currentScale -= 0.1; updateCanvasTransform(); } };
    resetViewBtn.onclick = () => { currentScale = 1; panOffsetX = 0; panOffsetY = 0; updateCanvasTransform(); };
    toggleDarkBtn.onclick = () => { document.body.classList.toggle('dark-mode'); drawBackground(); };

    function renderTabs() {
      tabsWrapper.innerHTML = '';
      pagesData.forEach((_, idx) => {
        const tab = document.createElement('div');
        tab.className = `board-tab ${idx === currentBoardPage ? 'active' : ''}`;
        tab.textContent = `পেজ ${idx + 1}`;
        tab.onclick = () => {
            pagesData[currentBoardPage].imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            currentBoardPage = idx;
            updateUIForPage();
        };
        tabsWrapper.appendChild(tab);
      });
    }

    function updateUIForPage() {
        boardPageNumSpan.textContent = `পেজ: ${currentBoardPage + 1}/${pagesData.length}`;
        if (pagesData[currentBoardPage].imageData) ctx.putImageData(pagesData[currentBoardPage].imageData, 0, 0);
        else drawBackground();

        if (pagesData[currentBoardPage].pdfDoc) {
            pdfControls.style.display = 'grid';
            pageNumSpan.textContent = `${pagesData[currentBoardPage].pageNum} / ${pagesData[currentBoardPage].numPages}`;
        } else {
            pdfControls.style.display = 'none';
        }
        renderTabs();
    }

    addBoardPageBtn.onclick = () => {
        pagesData[currentBoardPage].imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pagesData.push({ imageData: null, pdfDoc: null, pageNum: 1, numPages: 0 });
        currentBoardPage = pagesData.length - 1;
        updateUIForPage();
    };

    deleteBoardPageBtn.onclick = () => {
        if (pagesData.length <= 1) return;
        pagesData.splice(currentBoardPage, 1);
        if (currentBoardPage >= pagesData.length) currentBoardPage = pagesData.length - 1;
        updateUIForPage();
    };

    addStickyBtn.onclick = () => {
        const note = document.createElement('div');
        note.className = 'sticky-note';
        note.style.left = '120px'; 
        note.style.top = '120px';
        note.innerHTML = `<span class="close-note" title="বন্ধ করুন">&times;</span><textarea placeholder="নোট লিখুন..."></textarea>`;
        canvasContainer.appendChild(note);
        (note.querySelector('.close-note') as HTMLElement).onclick = () => note.remove();
    };

    /**
     * Sanitizes raw LaTeX and markdown artifacts completely out of mathematical/academic text
     * so it reads naturally like a textbook without $$, \mathbf, \qquad, \dots, etc.
     */
    function cleanMathText(text: string): string {
      if (!text) return '';
      return text
        .replace(/\r\n/g, '\n')
        // Clean LaTeX tags
        .replace(/\$\$\s*\\mathbf\{([^}]+)\}\s*\$\$/g, '$1')
        .replace(/\\mathbf\{([^}]+)\}/g, '$1')
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\textbf\{([^}]+)\}/g, '$1')
        .replace(/\\mathrm\{([^}]+)\}/g, '$1')
        .replace(/\\mathit\{([^}]+)\}/g, '$1')
        .replace(/\\qquad/g, '   ')
        .replace(/\\quad/g, '  ')
        .replace(/\\dots/g, '...')
        .replace(/\\cdots/g, '...')
        .replace(/\\ldots/g, '...')
        .replace(/\\cdot/g, ' × ')
        .replace(/\\times/g, ' × ')
        .replace(/\\div/g, ' ÷ ')
        .replace(/\\pm/g, ' ± ')
        .replace(/\\leq/g, ' ≤ ')
        .replace(/\\geq/g, ' ≥ ')
        .replace(/\\neq/g, ' ≠ ')
        .replace(/\\approx/g, ' ≈ ')
        .replace(/\\therefore/g, ' ∴ ')
        .replace(/\\because/g, ' ∵ ')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
        .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
        .replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, '$1√($2)')
        // Superscripts
        .replace(/\^2\b/g, '²')
        .replace(/\^3\b/g, '³')
        .replace(/\^4\b/g, '⁴')
        .replace(/\^n\b/g, 'ⁿ')
        // Strip $$ and $
        .replace(/\$\$/g, '')
        .replace(/\$/g, '')
        // Strip markdown formatting symbols
        .replace(/\*\*/g, '')
        .replace(/###/g, '')
        .replace(/##/g, '')
        .replace(/^#\s*/gm, '')
        .replace(/\\/g, '') // strip any remaining escape backslashes
        .trim();
    }

    function escapeHtml(str: string): string {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderAcademicSolutionHtml(markdown: string): string {
      const cleaned = cleanMathText(markdown);
      const lines = cleaned.split('\n');
      const htmlParts: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const isHeading = trimmed.startsWith('১.') || trimmed.startsWith('২.') || trimmed.startsWith('৩.') || trimmed.startsWith('৪.') || trimmed.startsWith('৫.') || trimmed.includes('চিহ্নিত প্রশ্ন') || trimmed.includes('সূত্র ও তত্ত্ব') || trimmed.includes('ধারাবাহিক') || trimmed.includes('চূড়ান্ত ফলাফল') || trimmed.includes('টিপস');
        const isAnswer = trimmed.includes('চূড়ান্ত ফলাফল') || trimmed.includes('উত্তর:');

        if (isHeading) {
          htmlParts.push(`<h4 class="text-sm md:text-base font-black text-indigo-900 border-b pb-1.5 mt-3.5 flex items-center gap-1.5">${escapeHtml(trimmed)}</h4>`);
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const item = trimmed.substring(2);
          htmlParts.push(`<li class="text-xs font-bold text-slate-800 ml-4 list-disc">${escapeHtml(item)}</li>`);
        } else if (isAnswer) {
          htmlParts.push(`<div class="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl my-2.5 text-emerald-950 font-black text-xs md:text-sm shadow-sm">${escapeHtml(trimmed)}</div>`);
        } else {
          htmlParts.push(`<p class="text-xs font-bold text-slate-800 leading-relaxed">${escapeHtml(trimmed)}</p>`);
        }
      }

      return htmlParts.join('\n');
    }

    /**
     * Inserts the cleaned text cleanly onto the canvas.
     * If onNewPage is true, creates a fresh page so the student question and solution never overlap!
     * If on current board, draws a clean white card backdrop so it never clashes with handwritten ink.
     */
    function insertTextLinesOnCanvas(rawText: string, onNewPage = false) {
      const cleaned = cleanMathText(rawText);
      const lines = cleaned.split('\n');

      if (onNewPage) {
        pagesData[currentBoardPage].imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pagesData.push({ imageData: null, pdfDoc: null, pageNum: 1, numPages: 0 });
        currentBoardPage = pagesData.length - 1;
        updateUIForPage();
      }

      const startX = onNewPage ? 80 : 70;
      let currentY = onNewPage ? 80 : Math.max(100, canvas.height * 0.22);
      const maxWidth = canvas.width - startX * 2;

      saveState();

      // If on existing page with drawings, draw a clean semi-transparent white card backdrop
      if (!onNewPage) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.strokeStyle = '#4338ca';
        ctx.lineWidth = 2;
        const estimatedHeight = Math.min(canvas.height - currentY - 40, lines.length * 34 + 60);
        const r = 16;
        const x = startX - 25;
        const y = currentY - 25;
        const w = maxWidth + 50;
        const h = estimatedHeight;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.textBaseline = 'top';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          currentY += 12;
          continue;
        }

        const isHeading = line.startsWith('১.') || line.startsWith('২.') || line.startsWith('৩.') || line.startsWith('৪.') || line.startsWith('৫.') || line.includes('চিহ্নিত প্রশ্ন') || line.includes('সূত্র ও তত্ত্ব') || line.includes('ধারাবাহিক') || line.includes('চূড়ান্ত ফলাফল') || line.includes('টিপস');
        const isAnswer = line.includes('চূড়ান্ত ফলাফল') || line.includes('উত্তর:');

        if (isHeading) {
          ctx.font = 'bold 22px Kalpurush, sans-serif';
          ctx.fillStyle = '#312e81';
          currentY += 8;
        } else if (isAnswer) {
          ctx.font = 'bold 22px Kalpurush, sans-serif';
          ctx.fillStyle = '#065f46';
        } else {
          ctx.font = '19px Kalpurush, sans-serif';
          ctx.fillStyle = '#0f172a';
        }

        const words = line.split(' ');
        let currentLine = '';
        for (const w of words) {
          const testLine = currentLine ? `${currentLine} ${w}` : w;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            ctx.fillText(currentLine, startX, currentY);
            currentY += isHeading ? 32 : 28;
            currentLine = w;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          ctx.fillText(currentLine, startX, currentY);
          currentY += isHeading ? 34 : 28;
        }

        if (currentY > canvas.height - 60) break;
      }

      saveState();
    }

    function getOptimizedCanvasDataUrl(sourceCanvas: HTMLCanvasElement): string {
      const maxDim = 1600;
      let w = sourceCanvas.width;
      let h = sourceCanvas.height;
      if (w > maxDim || h > maxDim) {
        const scale = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(sourceCanvas, 0, 0, w, h);
        return tempCanvas.toDataURL('image/jpeg', 0.82);
      }
      return sourceCanvas.toDataURL('image/jpeg', 0.82);
    }

    // High-Power Gemini Vision OCR
    ocrBtn.onclick = async () => {
      ocrBtn.textContent = '⏳ স্ক্যান হচ্ছে...';
      try {
        const dataUrl = getOptimizedCanvasDataUrl(canvas);
        aiModal.classList.remove('hidden');
        aiModalTitle.innerHTML = '<span class="flex items-center gap-2">📝 এআই ভিশন OCR (অটো-শনাক্তকরণ)</span>';
        aiBody.innerHTML = `
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <div class="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="font-bold text-slate-800 text-sm">হোয়াইটবোর্ডের লেখা ও সমীকরণগুলো স্ক্যান ও ডিজিটালাইজ করা হচ্ছে...</p>
            <p class="text-xs text-muted-foreground mt-1">জেমিনি ভিশন এআই দিয়ে নিখুঁতভাবে শনাক্ত করা হচ্ছে</p>
          </div>
        `;

        const res = await performWhiteboardVisionOcr(dataUrl);

        if (!res.success || !res.text) {
          aiBody.innerHTML = `
            <div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-bold">
              ⚠️ ${res.error || 'বোর্ডে কোনো স্পষ্ট লেখা বা সূত্র পাওয়া যায়নি। অনুগ্রহ করে বোর্ডে লিখে পুনরায় চেষ্টা করুন।'}
            </div>
          `;
          return;
        }

        const recognizedText = cleanMathText(res.text);
        aiBody.innerHTML = `
          <div class="space-y-4 font-kalpurush">
            <div class="flex items-center justify-between pb-2 border-b">
              <span class="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                ✓ সফলভাবে শনাক্ত হয়েছে
              </span>
              <div class="flex gap-2">
                <button id="copy-ocr-text-btn" class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-black transition-colors flex items-center gap-1">
                  📋 কপি করুন
                </button>
                <button id="insert-ocr-text-btn" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-colors flex items-center gap-1">
                  ✍️ বোর্ডে লিখুন
                </button>
              </div>
            </div>

            <div class="p-4 bg-slate-50 border-2 border-slate-200 rounded-xl max-h-[360px] overflow-y-auto">
              <pre class="font-kalpurush text-sm text-slate-900 whitespace-pre-wrap leading-relaxed font-bold">${escapeHtml(recognizedText)}</pre>
            </div>
          </div>
        `;

        const copyBtn = document.getElementById('copy-ocr-text-btn');
        if (copyBtn) {
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(recognizedText);
            copyBtn.textContent = '✓ কপি হয়েছে!';
            setTimeout(() => { copyBtn.textContent = '📋 কপি করুন'; }, 2000);
          };
        }

        const insertBtn = document.getElementById('insert-ocr-text-btn');
        if (insertBtn) {
          insertBtn.onclick = () => {
            insertTextLinesOnCanvas(recognizedText, false);
            aiModal.classList.add('hidden');
          };
        }
      } catch (err: any) {
        aiBody.innerHTML = `
          <div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-bold">
            ⚠️ ত্রুটি: ${err?.message || 'OCR ব্যর্থ হয়েছে।'}
          </div>
        `;
      } finally {
        ocrBtn.textContent = '📝 OCR';
      }
    };

    // Super AI Academic Problem Solver (Deep Step-by-Step Solutions)
    aiSolveBtn.onclick = async () => {
      aiSolveBtn.textContent = '🤖 এআই সলভ...';
      try {
        const dataUrl = getOptimizedCanvasDataUrl(canvas);
        aiModal.classList.remove('hidden');
        aiModalTitle.innerHTML = '<span class="flex items-center gap-2">🧠 সুপার এআই অ্যাকাডেমিক সমাধান (জেমিনি ভিশন)</span>';
        aiBody.innerHTML = `
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <div class="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p class="font-black text-slate-800 text-base">হোয়াইটবোর্ডের সমস্যা বিশ্লেষণ ও সম্পূর্ণ নির্ভুল সমাধান তৈরি হচ্ছে...</p>
            <p class="text-xs text-muted-foreground mt-1.5 max-w-sm">বোর্ডে থাকা অংক, জ্যামিতি, পদার্থবিজ্ঞান, রসায়ন বা যেকোনো জটিল প্রশ্ন ধাপে ধাপে সমাধান করা হচ্ছে</p>
          </div>
        `;

        const res = await solveWhiteboardProblem(dataUrl);

        if (!res.success || !res.solution) {
          aiBody.innerHTML = `
            <div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-bold">
              ⚠️ ${res.error || 'সমস্যা সমাধান করা সম্ভব হয়নি। অনুগ্রহ করে বোর্ডে পরিষ্কারভাবে প্রশ্ন লিখে পুনরায় চেষ্টা করুন।'}
            </div>
          `;
          return;
        }

        const solutionText = cleanMathText(res.solution);
        const renderedHtml = renderAcademicSolutionHtml(solutionText);

        aiBody.innerHTML = `
          <div class="space-y-4 font-kalpurush">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b">
              <span class="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                ✓ সম্পূর্ণ নির্ভুল সমাধান প্রস্তুত
              </span>
              <div class="flex flex-wrap gap-2">
                <button id="copy-ai-solution-btn" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-black transition-colors flex items-center gap-1 shadow-sm">
                  📋 কপি
                </button>
                <button id="insert-ai-solution-newpage-btn" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-colors flex items-center gap-1 shadow-sm" title="প্রশ্ন অক্ষত রেখে পেজ ২ এ সম্পূর্ণ সমাধান লিখবে">
                  📄 নতুন পেজে লিখুন
                </button>
                <button id="insert-ai-solution-btn" class="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-colors flex items-center gap-1 shadow-sm" title="বর্তমান বোর্ডের ওপর পরিচ্ছন্ন কার্ডে লিখবে">
                  ✍️ বর্তমান বোর্ডে
                </button>
              </div>
            </div>

            <div class="p-5 bg-slate-50/70 border-2 border-slate-200 rounded-2xl max-h-[460px] overflow-y-auto space-y-3 leading-relaxed text-slate-800">
              ${renderedHtml}
            </div>
          </div>
        `;

        const copySolBtn = document.getElementById('copy-ai-solution-btn');
        if (copySolBtn) {
          copySolBtn.onclick = () => {
            navigator.clipboard.writeText(solutionText);
            copySolBtn.textContent = '✓ কপি হয়েছে!';
            setTimeout(() => { copySolBtn.textContent = '📋 কপি'; }, 2000);
          };
        }

        // Insert on a clean NEW page (Best experience: Question on Page 1, Solution on Page 2)
        const insertNewPageBtn = document.getElementById('insert-ai-solution-newpage-btn');
        if (insertNewPageBtn) {
          insertNewPageBtn.onclick = () => {
            insertTextLinesOnCanvas(solutionText, true);
            aiModal.classList.add('hidden');
          };
        }

        // Insert on current page (Clean white card, no clash with question ink)
        const insertSolBtn = document.getElementById('insert-ai-solution-btn');
        if (insertSolBtn) {
          insertSolBtn.onclick = () => {
            insertTextLinesOnCanvas(solutionText, false);
            aiModal.classList.add('hidden');
          };
        }

      } catch (err: any) {
        aiBody.innerHTML = `
          <div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-bold">
            ⚠️ সমাধান তৈরিতে সমস্যা হয়েছে: ${err?.message || 'পুনরায় চেষ্টা করুন।'}
          </div>
        `;
      } finally {
        aiSolveBtn.textContent = '🤖 এআই সলভ';
      }
    };

    closeAiBtn.onclick = () => aiModal.classList.add('hidden');

    // AI Diagram Draw: Generate SVG from text description and render on canvas
    aiDrawBtn.onclick = () => aiDrawWidget.classList.toggle('hidden');

    const aiDrawDoBtn = document.getElementById('ai-draw-do-btn')!;
    const aiDrawInput = document.getElementById('ai-draw-input') as HTMLInputElement;
    const aiDrawStatus = document.getElementById('ai-draw-status')!;

    aiDrawDoBtn.onclick = async () => {
      const desc = aiDrawInput.value.trim();
      if (!desc) { aiDrawStatus.textContent = '⚠️ চিত্রের নাম বা বর্ণনা লিখুন।'; return; }
      aiDrawDoBtn.textContent = '⏳ তৈরি হচ্ছে...';
      aiDrawDoBtn.setAttribute('disabled', 'true');
      aiDrawStatus.textContent = '🤖 AI চিত্র তৈরি করছে, অনুগ্রহ করে অপেক্ষা করুন...';
      try {
        const result = await generateWhiteboardDiagram(desc);
        if (!result.success || !result.svg) {
          aiDrawStatus.textContent = `⚠️ ${result.error || 'চিত্র তৈরি হয়নি, পুনরায় চেষ্টা করুন।'}`;
          return;
        }
        // Ensure SVG dimensions and viewbox
        let safeSvg = result.svg;
        try {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(safeSvg, 'image/svg+xml');
          const svgRoot = svgDoc.documentElement;
          svgRoot.setAttribute('width', '1200');
          svgRoot.setAttribute('height', '720');
          if (!svgRoot.getAttribute('viewBox')) svgRoot.setAttribute('viewBox', '0 0 1200 720');
          safeSvg = new XMLSerializer().serializeToString(svgRoot);
        } catch (e) {
          console.warn('SVG parse error:', e);
        }

        // Show as draggable overlay instead of burning to canvas
        const overlayContainer = document.getElementById('svg-overlays')!;
        const wrapper = document.createElement('div');
        wrapper.className = 'ai-diagram-overlay';
        wrapper.style.cssText = 'position:absolute;top:60px;left:40px;z-index:9999;border:2.5px dashed #7c3aed;border-radius:10px;background:#fff;box-shadow:0 8px 30px rgba(124,58,237,0.22);user-select:none;pointer-events:auto;';

        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg, #7c3aed, #4f46e5);padding:6px 12px;border-radius:8px 8px 0 0;cursor:grab;pointer-events:auto;user-select:none;';

        const moveLabel = document.createElement('span');
        moveLabel.textContent = '✥ টেনে সরান';
        moveLabel.style.cssText = 'color:#ffffff;font-size:13px;font-weight:bold;cursor:grab;display:flex;align-items:center;gap:4px;';

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex;align-items:center;gap:8px;pointer-events:auto;';

        const stampBtn = document.createElement('button');
        stampBtn.type = 'button';
        stampBtn.textContent = '📌 বোর্ডে স্থায়ী করুন';
        stampBtn.style.cssText = 'padding:6px 14px;background:#16a34a;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,0.25);pointer-events:auto;';

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = '🗑️ মুছুন';
        delBtn.style.cssText = 'padding:6px 12px;background:#dc2626;color:#ffffff;border:none;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,0.25);pointer-events:auto;';

        btnGroup.appendChild(stampBtn);
        btnGroup.appendChild(delBtn);
        toolbar.appendChild(moveLabel);
        toolbar.appendChild(btnGroup);

        const svgDiv = document.createElement('div');
        svgDiv.innerHTML = safeSvg;
        const svgEl = svgDiv.querySelector('svg');
        if (svgEl) {
          const maxW = Math.min(canvas.width * 0.85, 960);
          svgEl.setAttribute('width', String(maxW));
          svgEl.setAttribute('height', String(Math.round(maxW * 720 / 1200)));
          svgEl.style.display = 'block';
        }
        svgDiv.style.pointerEvents = 'none';

        wrapper.appendChild(toolbar);
        wrapper.appendChild(svgDiv);
        overlayContainer.appendChild(wrapper);

        // Drag logic attached ONLY to toolbar header
        let isDragging = false;
        let startClientX = 0, startClientY = 0;
        let startLeft = 0, startTop = 0;

        const onPointerDown = (e: PointerEvent) => {
          // If clicked a button, ignore drag
          if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) {
            return;
          }
          isDragging = true;
          startClientX = e.clientX;
          startClientY = e.clientY;
          startLeft = wrapper.offsetLeft;
          startTop = wrapper.offsetTop;
          toolbar.style.cursor = 'grabbing';
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          e.preventDefault();
          e.stopPropagation();
        };

        const onPointerMove = (e: PointerEvent) => {
          if (!isDragging) return;
          const deltaX = (e.clientX - startClientX) / currentScale;
          const deltaY = (e.clientY - startClientY) / currentScale;
          wrapper.style.left = (startLeft + deltaX) + 'px';
          wrapper.style.top = (startTop + deltaY) + 'px';
        };

        const onPointerUp = (e: PointerEvent) => {
          if (isDragging) {
            isDragging = false;
            toolbar.style.cursor = 'grab';
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {}
          }
        };

        toolbar.addEventListener('pointerdown', onPointerDown);
        toolbar.addEventListener('pointermove', onPointerMove);
        toolbar.addEventListener('pointerup', onPointerUp);
        toolbar.addEventListener('pointercancel', onPointerUp);

        // Delete button
        const handleDelete = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          wrapper.remove();
        };
        delBtn.onclick = handleDelete;
        delBtn.onpointerdown = (e) => e.stopPropagation();

        // Stamp to canvas permanently
        const handleStamp = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          const el = wrapper.querySelector('svg');
          if (!el) { wrapper.remove(); return; }
          const serialized = new XMLSerializer().serializeToString(el);
          const blob2 = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
          const url2 = URL.createObjectURL(blob2);
          const stamp = new Image();
          stamp.onload = () => {
            saveState();
            const canvasRect = canvas.getBoundingClientRect();
            const wrapRect = wrapper.getBoundingClientRect();
            const sx = (wrapRect.left - canvasRect.left) / currentScale;
            const sy = (wrapRect.top + toolbar.offsetHeight - canvasRect.top) / currentScale;
            const dw = (el.clientWidth || el.getBoundingClientRect().width) / currentScale;
            const dh = (el.clientHeight || el.getBoundingClientRect().height) / currentScale;
            ctx.drawImage(stamp, sx, sy, dw, dh);
            saveState();
            URL.revokeObjectURL(url2);
            wrapper.remove();
          };
          stamp.src = url2;
        };
        stampBtn.onclick = handleStamp;
        stampBtn.onpointerdown = (e) => e.stopPropagation();
        aiDrawStatus.textContent = '✅ চিত্র তৈরি হয়েছে! টেনে সরান বা বোর্ডে স্থায়ী করুন।';
        setTimeout(() => { aiDrawWidget.classList.add('hidden'); aiDrawStatus.textContent = ''; aiDrawInput.value = ''; }, 2200);
      } catch (err: any) {
        aiDrawStatus.textContent = `⚠️ ${err?.message || 'অজানা সমস্যা হয়েছে।'}`;
      } finally {
        aiDrawDoBtn.textContent = '🎨 আঁকুন';
        aiDrawDoBtn.removeAttribute('disabled');
      }
    };

    speechBtn.onclick = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return alert('আপনার ব্রাউজার ভয়েস টাইপিং সাপোর্ট করে না। ক্রোম ব্রাউজার ব্যবহার করুন।');
        const rec = new SpeechRecognition();
        rec.lang = 'bn-BD';
        speechBtn.textContent = '🎙️...';
        rec.start();
        rec.onresult = (e: any) => {
            const txt = e.results[0][0].transcript;
            ctx.font = '28px Kalpurush, sans-serif';
            ctx.fillStyle = colorPicker.value;
            ctx.fillText(txt, canvas.width / 4, canvas.height / 3);
            saveState();
        };
        rec.onerror = () => { speechBtn.textContent = '🎙️ ভয়েস'; };
        rec.onend = () => { speechBtn.textContent = '🎙️ ভয়েস'; };
    };

    let mediaRecorder: any, chunks: any[] = [];
    recordBtn.onclick = async () => {
        if (recordBtn.classList.contains('recording')) {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            recordBtn.classList.remove('recording');
            recordBtn.textContent = '🎥 রেকর্ড';
        } else {
            try {
              let stream: MediaStream;
              if ((canvas as any).captureStream) {
                try {
                  stream = (canvas as any).captureStream(30);
                } catch {
                  stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                }
              } else {
                stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
              }
              mediaRecorder = new MediaRecorder(stream);
              chunks = [];
              mediaRecorder.ondataavailable = (e: any) => chunks.push(e.data);
              mediaRecorder.onstop = () => {
                  const blob = new Blob(chunks, { type: 'video/webm' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'whiteboard_recording.webm'; a.click();
              };
              mediaRecorder.start();
              recordBtn.classList.add('recording');
              recordBtn.textContent = '⏹️ থামান';
            } catch (err) {
              alert('স্ক্রিন রেকর্ডিং শুরু করা যায়নি বা বাতিল করা হয়েছে।');
            }
        }
    };

    // Close buttons for widgets (Calculator, Math, Timer)
    document.querySelectorAll('.close-widget').forEach((el) => {
      (el as HTMLElement).onclick = (e) => {
        const w = (e.currentTarget as HTMLElement).closest('.widget');
        if (w) w.classList.add('hidden');
      };
    });

    mathToolBtn.onclick = () => mathWidget.classList.toggle('hidden');
    mathLatexInput.oninput = () => {
        mathPreview.innerHTML = `\\[${mathLatexInput.value}\\]`;
        if ((window as any).MathJax) (window as any).MathJax.typesetPromise([mathPreview]);
    };
    insertMathBtn.onclick = () => {
        const svg = mathPreview.querySelector('svg');
        if (svg) {
            const xml = new XMLSerializer().serializeToString(svg);
            const img = new Image();
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
            img.onload = () => { ctx.drawImage(img, 150, 150); saveState(); };
        } else {
            const formula = cleanMathText(mathLatexInput.value.trim());
            if (formula) {
              ctx.font = '24px Kalpurush, sans-serif';
              ctx.fillStyle = colorPicker.value;
              ctx.fillText(formula, 150, 150);
              saveState();
            }
        }
        mathWidget.classList.add('hidden');
    };

    calcBtn.onclick = () => calcWidget.classList.toggle('hidden');
    const calcScreen = document.getElementById('calc-screen') as HTMLInputElement;
    calcWidget.querySelectorAll('.calc-buttons button').forEach(b => {
        (b as HTMLElement).onclick = () => {
            const txt = b.textContent;
            if (txt === '=') { 
              try { 
                const clean = calcScreen.value.replace(/[^0-9+\-*/.]/g, '');
                calcScreen.value = Function(`'use strict'; return (${clean})`)(); 
              } catch { 
                calcScreen.value = 'ত্রুটি'; 
              } 
            }
            else if (txt === 'Clear') calcScreen.value = '';
            else calcScreen.value += txt;
        };
    });

    timerBtn.onclick = () => timerWidget.classList.toggle('hidden');
    let timerInt: any;
    document.getElementById('start-timer')!.onclick = () => {
        let sec = 0;
        clearInterval(timerInt);
        timerInt = setInterval(() => {
            sec++;
            const m = Math.floor(sec/60).toString().padStart(2,'0');
            const s = (sec%60).toString().padStart(2,'0');
            document.getElementById('timer-display')!.textContent = `${m}:${s}`;
        }, 1000);
    };
    document.getElementById('stop-timer')!.onclick = () => clearInterval(timerInt);
    document.getElementById('reset-timer')!.onclick = () => { clearInterval(timerInt); document.getElementById('timer-display')!.textContent = '00:00'; };

    // 3D Geometry Viewer
    const view3dBtn = document.getElementById('view-3d-btn');
    const modal3d = document.getElementById('modal-3d');
    const close3d = document.getElementById('close-3d');
    const container3d = document.getElementById('container-3d');
    let threeAnimationId: number | null = null;
    let threeRenderer: any = null;

    if (view3dBtn && modal3d && close3d && container3d) {
      view3dBtn.onclick = () => {
        modal3d.classList.remove('hidden');
        if (!(window as any).THREE) {
          container3d.innerHTML = '<div style="color:white;display:flex;align-items:center;justify-content:center;height:100%;font-weight:bold;">৩ডি লাইব্রেরি (Three.js) লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</div>';
          return;
        }

        container3d.innerHTML = '';
        const THREE = (window as any).THREE;
        const width = container3d.clientWidth || 580;
        const height = container3d.clientHeight || 400;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f172a);

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 2, 5);

        threeRenderer = new THREE.WebGLRenderer({ antialias: true });
        threeRenderer.setSize(width, height);
        container3d.appendChild(threeRenderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0x6366f1, 1.2);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        const group = new THREE.Group();

        // Cube
        const cubeGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
        const cubeMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 });
        const cube = new THREE.Mesh(cubeGeo, cubeMat);
        cube.position.x = -1.4;
        const cubeEdges = new THREE.EdgesGeometry(cubeGeo);
        cube.add(new THREE.LineSegments(cubeEdges, new THREE.LineBasicMaterial({ color: 0xffffff })));
        group.add(cube);

        // Sphere
        const sphereGeo = new THREE.SphereGeometry(0.75, 32, 16);
        const sphereMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.x = 1.4;
        group.add(sphere);

        // Cone
        const coneGeo = new THREE.ConeGeometry(0.7, 1.4, 32);
        const coneMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.y = 1.1;
        group.add(cone);

        scene.add(group);

        let isDragging3D = false;
        let prevMouseX = 0;
        let prevMouseY = 0;

        container3d.onmousedown = (e: MouseEvent) => {
          isDragging3D = true;
          prevMouseX = e.clientX;
          prevMouseY = e.clientY;
        };
        window.addEventListener('mouseup', () => { isDragging3D = false; });
        container3d.onmousemove = (e: MouseEvent) => {
          if (!isDragging3D) return;
          const deltaX = e.clientX - prevMouseX;
          const deltaY = e.clientY - prevMouseY;
          group.rotation.y += deltaX * 0.01;
          group.rotation.x += deltaY * 0.01;
          prevMouseX = e.clientX;
          prevMouseY = e.clientY;
        };

        const animate = () => {
          threeAnimationId = requestAnimationFrame(animate);
          if (!isDragging3D) {
            group.rotation.y += 0.008;
            group.rotation.x += 0.004;
          }
          threeRenderer.render(scene, camera);
        };
        animate();
      };

      close3d.onclick = () => {
        modal3d.classList.add('hidden');
        if (threeAnimationId) cancelAnimationFrame(threeAnimationId);
        if (threeRenderer) {
          threeRenderer.dispose();
          threeRenderer = null;
        }
        container3d.innerHTML = '';
      };
    }

    spotlightBtn.onclick = () => spotlightOverlay.classList.toggle('hidden');
    const spotlightMoveHandler = (e: MouseEvent) => {
        if (!spotlightOverlay.classList.contains('hidden')) {
            const rect = canvasContainer.getBoundingClientRect();
            spotlightOverlay.style.background = `radial-gradient(circle 120px at ${e.clientX - rect.left}px ${e.clientY - rect.top}px, transparent 100%, rgba(0,0,0,0.85) 100%)`;
        }
    };
    canvasContainer.addEventListener('mousemove', spotlightMoveHandler);

    curtainBtn.onclick = () => { presentationCurtain.classList.toggle('hidden'); presentationCurtain.style.height = '50%'; };
    let curtainDragging = false;
    curtainHandle.onmousedown = () => curtainDragging = true;
    const curtainMouseMoveHandler = (e: MouseEvent) => {
        if (curtainDragging) {
            const rect = canvasContainer.getBoundingClientRect();
            let h = e.clientY - rect.top;
            presentationCurtain.style.height = `${Math.max(0, Math.min(h, rect.height))}px`;
        }
    };
    document.addEventListener('mousemove', curtainMouseMoveHandler);
    const curtainMouseUpHandler = () => { curtainDragging = false; };
    document.addEventListener('mouseup', curtainMouseUpHandler);

    fullscreenBtn.onclick = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); };

    saveImgBtn.onclick = () => { const a = document.createElement('a'); a.href = canvas.toDataURL(); a.download = 'whiteboard.png'; a.click(); };
    savePdfBtn.onclick = () => {
        if (!(window as any).jspdf) {
          alert('PDF জেনারেটর প্রস্তুত হচ্ছে...');
          return;
        }
        const pdf = new (window as any).jspdf.jsPDF('l', 'px', [canvas.width, canvas.height]);
        pdf.addImage(canvas.toDataURL(), 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('whiteboard.pdf');
    };
    
    // PDF Upload
    uploadBtn.onclick = () => pdfUpload.click();
    pdfUpload.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function() {
                const typedarray = new Uint8Array(this.result as ArrayBuffer);
                if (!(window as any).pdfjsLib) {
                  alert('PDF রিডার লাইব্রেরি লোড হচ্ছে...');
                  return;
                }
                (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                (window as any).pdfjsLib.getDocument(typedarray).promise.then((pdf: any) => {
                    pagesData[currentBoardPage].pdfDoc = pdf;
                    pagesData[currentBoardPage].numPages = pdf.numPages;
                    pagesData[currentBoardPage].pageNum = 1;
                    renderPdfPage(1);
                });
            };
            reader.readAsArrayBuffer(file);
        }
    };

    // Image Upload to Canvas
    if (imgUploadBtn && imgUpload) {
      imgUploadBtn.onclick = () => imgUpload.click();
      imgUpload.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              saveState();
              const maxDim = 700;
              let w = img.width;
              let h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = (h * maxDim) / w;
                  w = maxDim;
                } else {
                  w = (w * maxDim) / h;
                  h = maxDim;
                }
              }
              const cx = (canvas.width - w) / 2;
              const cy = (canvas.height - h) / 2;
              ctx.drawImage(img, cx, cy, w, h);
              saveState();
            };
            img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
        }
      };
    }

    function renderPdfPage(num: number) {
        const currentBoard = pagesData[currentBoardPage];
        if (!currentBoard.pdfDoc) return;
        currentBoard.pdfDoc.getPage(num).then((page: any) => {
            const vp = page.getViewport({ scale: 1.5 });
            canvas.width = vp.width; 
            canvas.height = vp.height;
            drawBackground(); 
            page.render({ canvasContext: ctx, viewport: vp }).promise.then(() => {
                pageNumSpan.textContent = `${num} / ${currentBoard.numPages}`;
                pdfControls.style.display = 'grid';
                currentBoard.pageNum = num;
                currentBoard.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            });
        });
    }

    prevPageBtn.onclick = () => {
        const currentBoard = pagesData[currentBoardPage];
        if (currentBoard.pdfDoc && currentBoard.pageNum > 1) {
            currentBoard.pageNum--;
            renderPdfPage(currentBoard.pageNum);
        }
    };

    nextPageBtn.onclick = () => {
        const currentBoard = pagesData[currentBoardPage];
        if (currentBoard.pdfDoc && currentBoard.pageNum < currentBoard.numPages) {
            currentBoard.pageNum++;
            renderPdfPage(currentBoard.pageNum);
        }
    };

    // Restore autosaved data if available, or draw fresh background
    try {
      const saved = localStorage.getItem('whiteboard_autosave_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.bg) {
          currentBgStyle = parsed.bg;
          document.querySelectorAll('.bg-btn').forEach(b => {
            if (b.getAttribute('data-bg') === currentBgStyle) b.classList.add('active');
            else b.classList.remove('active');
          });
        }
        drawBackground();
        if (parsed.image) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            saveState();
          };
          img.src = parsed.image;
        }
      } else {
        drawBackground();
      }
    } catch (e) {
      drawBackground();
    }

    renderTabs();
    isInitialized.current = true;

    return () => {
      canvas.removeEventListener('pointerdown', startDrawing);
      canvas.removeEventListener('pointermove', draw);
      canvas.removeEventListener('pointerup', stopDrawing);
      document.querySelectorAll('.tool-btn').forEach(btn => btn.removeEventListener('click', toolBtnHandler));
      document.querySelectorAll('.bg-btn').forEach(btn => btn.removeEventListener('click', bgBtnHandler));
      toggleSidebarBtn.removeEventListener('click', toggleSidebarHandler);
      toggleRightSidebarBtn.removeEventListener('click', toggleRightSidebarHandler);
      canvasContainer.removeEventListener('mousemove', spotlightMoveHandler);
      document.removeEventListener('mousemove', curtainMouseMoveHandler);
      document.removeEventListener('mouseup', curtainMouseUpHandler);
      if (threeAnimationId) cancelAnimationFrame(threeAnimationId);
      if (threeRenderer) {
        threeRenderer.dispose();
      }
      isInitialized.current = false;
    };
  }, []);

  return (
    <div className="whiteboard-body font-kalpurush">
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js" strategy="afterInteractive" onReady={handleScriptLoad} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js" strategy="afterInteractive" onReady={handleScriptLoad} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="afterInteractive" onReady={handleScriptLoad} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" strategy="afterInteractive" onReady={handleScriptLoad} />
      <Script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js" strategy="afterInteractive" onReady={handleScriptLoad} />
      <Script src="https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js" strategy="afterInteractive" onReady={handleScriptLoad} />
      <Script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" strategy="afterInteractive" onReady={handleScriptLoad} />

      <div id="browser-tabs-container" className="no-print">
        <div id="tabs-wrapper"></div>
        <button id="add-board-page" className="browser-plus-btn top-plus-btn" title="নতুন পেজ">➕</button>
        <button id="delete-board-page" className="browser-delete-btn" title="ডিলিট">🗑️</button>
        <button id="clear">🗑️ মুছুন</button>
        <div id="cloud-sync-status" className="sync-indicator">
          <span id="sync-icon">☁️</span> <span id="sync-text">অটো-সেভ সক্রিয়...</span>
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
          <button type="button" className="tool-btn" data-tool="pan">✋ প্যান/সরান</button>
        </div>
        <label>মোছা ও পয়েন্টার:</label>
        <div className="tool-group">
          <button type="button" className="tool-btn" data-tool="eraser">🧹 ইরেজার</button>
          <button type="button" className="tool-btn" data-tool="area-eraser">🔲 এরিয়া ইরেজার</button>
          <button type="button" className="tool-btn" data-tool="laser">🔴 লেজার ডট</button>
        </div>
        <label>জ্যামিতিক টুলস:</label>
        <div className="tool-group">
          <button type="button" className="tool-btn" data-tool="line">📏 লাইন</button>
          <button type="button" className="tool-btn" data-tool="rectangle">⬛ আয়তক্ষেত্র</button>
          <button type="button" className="tool-btn" data-tool="circle">⭕ বৃত্ত</button>
          <button type="button" className="tool-btn" data-tool="triangle">🔺 ত্রিভুজ</button>
          <button type="button" className="tool-btn" data-tool="right-triangle">📐 সমকোণী</button>
          <button type="button" className="tool-btn" data-tool="diamond">🔷 রম্বস</button>
          <button type="button" className="tool-btn" data-tool="star">⭐ তারা</button>
          <button type="button" className="tool-btn" data-tool="protractor">📐 চাঁদা</button>
          <button type="button" className="tool-btn" data-tool="compass">🧭 কম্পাস</button>
          <button type="button" className="tool-btn" data-tool="text">🔤 টেক্সট</button>
        </div>
        <hr style={{ width: '100%', border: '1px solid #ffffff55' }} />
        <label>কালার:</label>
        <input type="color" id="color" defaultValue="#000000" />
        <label>সাইজ:</label>
        <input type="range" id="size" min="1" max="50" defaultValue="5" />
        <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="fill-shape" className="w-4 h-4" /> শেপ ফিল
        </label>
      </div>

      <div id="right-toolbar" className="sidebar right-sidebar no-print">
        <label>ব্যাকগ্রাউন্ড:</label>
        <div className="bg-btn-group">
          <button type="button" className="bg-btn active" data-bg="blank">⬜ খালি</button>
          <button type="button" className="bg-btn" data-bg="grid">▦ গ্রিড</button>
          <button type="button" className="bg-btn" data-bg="graph">📈 গ্রাফ</button>
          <button type="button" className="bg-btn" data-bg="isometric">⁞ আইসো</button>
          <button type="button" className="bg-btn" data-bg="ruled">≡ রুল</button>
        </div>
        <button id="toggle-dark">🌙 ডার্ক মোড</button>
        <div id="page-controls">
          <span id="board-page-num">পেজ: ১/১</span>
        </div>
        <button id="undo-btn">↩️ আনডু</button>
        <button id="redo-btn">↪️ রিডু</button>
        <button id="zoom-in">🔍 জুম ইন</button>
        <button id="zoom-out">🔎 জুম আউট</button>
        <button id="reset-view-btn">🎯 রিসেট</button>
        <button id="add-sticky">📌 স্টিকি</button>
        <button id="ocr-btn">📝 OCR</button>
        <button id="ai-solve-btn">🤖 এআই সলভ</button>
        <button id="ai-draw-btn" style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: 'white', fontWeight: 'bold' }}>🎨 AI চিত্র</button>
        <button id="math-tool-btn">{"∑math LaTeX"}</button>
        <button id="view-3d-btn">🧊 ৩ডি ভিউয়ার</button>
        <button id="calc-btn">🧮 ক্যালকুলেটর</button>
        <button id="timer-btn">⏱️ টাইমার</button>
        <button id="spotlight-btn">🔦 স্পটলাইট</button>
        <button id="curtain-btn">🚪 পর্দা</button>
        <button id="fullscreen-btn">📺 ফুলস্ক্রিন</button>
        <button id="speech-btn">🎙️ ভয়েস</button>
        <button id="record-btn">🎥 রেকর্ড</button>
        <input type="file" id="pdf-upload" accept="application/pdf" style={{ display: 'none' }} />
        <button id="upload-btn">📂 PDF আপলোড</button>
        
        <input type="file" id="img-upload" accept="image/*" style={{ display: 'none' }} />
        <button id="img-upload-btn">🖼️ ছবি আপলোড</button>

        <div id="pdf-controls" style={{ display: 'none' }}>
          <label className="text-[10px] font-black text-white uppercase text-center mt-2">PDF পাতা</label>
          <span id="page-num" className="text-white font-black text-xs text-center py-1">১ / ১</span>
          <div className="grid grid-cols-2 gap-1 w-full">
            <button id="prev-page" className="h-8 text-[10px] font-black">আগের</button>
            <button id="next-page" className="h-8 text-[10px] font-black">পরের</button>
          </div>
        </div>

        <button id="save-img">💾 ছবি সেভ</button>
        <button id="save-pdf">📄 PDF সেভ</button>
      </div>

      <div id="scroll-wrapper">
        <div id="canvas-container">
          <canvas id="board"></canvas>
          <div id="laser-dot" className="hidden"></div>
          <div id="presentation-curtain" className="hidden">
            <div id="curtain-handle">🚪 পর্দা</div>
          </div>
          <div id="spotlight-overlay" className="hidden"></div>
          <div id="svg-overlays" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'auto', zIndex: 50 }}></div>
        </div>
      </div>

      <div id="modal-3d" className="hidden">
        <div className="modal-content">
          <span id="close-3d" title="বন্ধ করুন">&times;</span>
          <h4 style={{ color: 'white', fontWeight: 'bold', marginBottom: '10px' }}>🧊 ৩ডি জ্যামিতিক মডেল ভিউয়ার (মাউস দিয়ে ঘোরান)</h4>
          <div id="container-3d"></div>
        </div>
      </div>

      {/* High-Power AI Modal (OCR & Deep Academic Solution) */}
      <div id="ai-modal" className="widget hidden flex flex-col p-0">
          <div className="bg-gradient-to-r from-indigo-700 via-primary to-indigo-800 p-4 text-white flex justify-between items-center shadow-md">
              <h4 id="ai-modal-title" className="font-black text-base md:text-lg flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-yellow-300" /> এআই সমাধান ও বিশ্লেষণ
              </h4>
              <button id="close-ai-modal" className="text-white hover:text-rose-200 transition-colors p-1 rounded-lg">
                <XCircle className="w-6 h-6" />
              </button>
          </div>
          <div id="ai-solution-body" className="p-5 overflow-y-auto flex-1 bg-white text-slate-900"></div>
      </div>

      <div id="calc-widget" className="widget hidden">
        <div className="widget-header">🧮 ক্যালকুলেটর <span className="close-widget" title="বন্ধ করুন">&times;</span></div>
        <input type="text" id="calc-screen" readOnly style={{width:'100%', marginBottom:'10px', textAlign:'right', padding:'5px', color:'black'}} />
        <div className="calc-buttons" style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'5px'}}>
          <button>7</button><button>8</button><button>9</button><button>/</button>
          <button>4</button><button>5</button><button>6</button><button>*</button>
          <button>1</button><button>2</button><button>3</button><button>-</button>
          <button>0</button><button>.</button><button>=</button><button>+</button>
          <button style={{ gridColumn: 'span 4', background: '#e74c3c', color: 'white' }}>Clear</button>
        </div>
      </div>

      <div id="math-widget" className="widget hidden">
        <div className="widget-header">∑ ম্যাথ ইনপুট <span className="close-widget" title="বন্ধ করুন">&times;</span></div>
        <input type="text" id="math-latex-input" placeholder="LaTeX লিখুন (যেমন: x^2 + y^2 = r^2)..." style={{ width: '100%', padding:'5px', color:'black' }} />
        <div id="math-preview" style={{ background: '#fff', color: '#000', padding: '10px', minHeight: '40px', marginTop: '5px', borderRadius:'4px' }}></div>
        <button id="insert-math-btn" style={{ width: '100%', marginTop: '5px', background:'#27ae60', color:'white', padding:'8px', borderRadius:'6px' }}>বোর্ডে যোগ করুন</button>
      </div>

      <div id="timer-widget" className="widget hidden">
        <div className="widget-header">⏱️ টাইমার <span className="close-widget" title="বন্ধ করুন">&times;</span></div>
        <div id="timer-display" style={{ fontSize: '30px', textAlign: 'center', fontWeight: 'bold' }}>00:00</div>
        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
          <button id="start-timer" style={{flex: 1, padding:'5px', background:'#22c55e', color:'white', borderRadius:'4px'}}>শুরু</button>
          <button id="stop-timer" style={{flex: 1, padding:'5px', background:'#ef4444', color:'white', borderRadius:'4px'}}>বন্ধ</button>
          <button id="reset-timer" style={{flex: 1, padding:'5px', background:'#64748b', color:'white', borderRadius:'4px'}}>রিসেট</button>
        </div>
      </div>

      {/* AI Diagram Draw Widget */}
      <div id="ai-draw-widget" className="widget hidden" style={{ width: '320px', padding: '0', overflow: 'hidden', borderRadius: '14px', boxShadow: '0 8px 32px rgba(124,58,237,0.25)' }}>
        <div style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>🎨 AI দিয়ে চিত্র আঁকুন</span>
          <span className="close-widget" title="বন্ধ করুন" style={{ color: 'white', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>&times;</span>
        </div>
        <div style={{ padding: '14px', background: '#fff' }}>
          <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>
            যেকোনো চিত্রের নাম বা বর্ণনা লিখুন (বাংলা বা ইংরেজিতে)
          </p>
          <textarea
            id="ai-draw-input"
            placeholder="উদাহরণ: মানব হৃদয়ের চিত্র, বৈদ্যুতিক বর্তনী, পানি চক্র, সমকোণী ত্রিভুজ, DNA গঠন..."
            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1.5px solid #7c3aed', fontSize: '12px', color: '#0f172a', minHeight: '80px', resize: 'vertical', fontFamily: 'Kalpurush, sans-serif', outline: 'none', boxSizing: 'border-box' }}
          />
          <button
            id="ai-draw-do-btn"
            style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
          >
            🎨 আঁকুন
          </button>
          <p id="ai-draw-status" style={{ marginTop: '8px', fontSize: '11px', color: '#7c3aed', fontWeight: 700, minHeight: '16px', textAlign: 'center' }}></p>
        </div>
      </div>

      <button className="back-home-btn no-print" onClick={() => router.push('/')}>
        <ArrowLeft className="w-4 h-4" /> পোর্টালে ফিরুন
      </button>
    </div>
  );
}
