'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { ArrowLeft, XCircle, BrainCircuit, Sparkles, Copy, Check, CheckCircle2 } from 'lucide-react';
import { performWhiteboardVisionOcr, solveWhiteboardProblem, generateWhiteboardDiagram } from '@/ai/flows/whiteboard-solver-flow';
import { getFirebaseApp } from '@/firebase/config';
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

    clearBtn.onclick = () => {
      saveState();
      drawBackground();
      const oc = document.getElementById('svg-overlays');
      if (oc) oc.innerHTML = '';
      if (pagesData[currentBoardPage]) pagesData[currentBoardPage].overlays = [];
    };
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

        const saveCurrentPageOverlays = () => {
      const overlays: any[] = [];
      document.querySelectorAll('.ai-diagram-overlay').forEach((w) => {
        const svgEl = w.querySelector('svg');
        if (svgEl) {
          const rect = (w as HTMLElement).style;
          const tb = w.querySelector('.ai-diagram-toolbar') as HTMLElement | null;
          overlays.push({
            svg: new XMLSerializer().serializeToString(svgEl),
            left: rect.left || '40px',
            top: rect.top || '60px',
            stamped: tb ? tb.style.display === 'none' : false,
          });
        }
      });
      if (pagesData[currentBoardPage]) {
        pagesData[currentBoardPage].overlays = overlays;
      }
    };

    const restorePageOverlays = (pageIdx: number) => {
      const oc = document.getElementById('svg-overlays');
      if (oc) oc.innerHTML = '';
      const pOverlays = pagesData[pageIdx]?.overlays || [];
      pOverlays.forEach((ov: any) => {
        createInteractiveDiagramOverlay(ov.svg, { left: ov.left, top: ov.top, stamped: ov.stamped });
      });
    };

    function renderTabs() {
      tabsWrapper.innerHTML = '';
      pagesData.forEach((_, idx) => {
        const tab = document.createElement('div');
        tab.className = `board-tab ${idx === currentBoardPage ? 'active' : ''}`;
        tab.textContent = `পেজ ${idx + 1}`;
        tab.onclick = () => {
            saveCurrentPageOverlays();
            pagesData[currentBoardPage].imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            currentBoardPage = idx;
            updateUIForPage();
        };
        tabsWrapper.appendChild(tab);
      });
    }

    function updateUIForPage() {
        boardPageNumSpan.textContent = `পেজ: ${currentBoardPage + 1}/${pagesData.length}`;
        if (pagesData[currentBoardPage].imageData) {
          ctx.putImageData(pagesData[currentBoardPage].imageData, 0, 0);
        } else {
          drawBackground();
        }

        restorePageOverlays(currentBoardPage);

        if (pagesData[currentBoardPage].pdfDoc) {
            pdfControls.style.display = 'grid';
            pageNumSpan.textContent = `${pagesData[currentBoardPage].pageNum} / ${pagesData[currentBoardPage].numPages}`;
        } else {
            pdfControls.style.display = 'none';
        }
        renderTabs();
    }

    addBoardPageBtn.onclick = () => {
        saveCurrentPageOverlays();
        pagesData[currentBoardPage].imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pagesData.push({ imageData: null, pdfDoc: null, pageNum: 1, numPages: 0, overlays: [] });
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

    // ---- Reusable: create interactive diagram overlay (used on load too) ----
    const createInteractiveDiagramOverlay = (svgString: string, opts?: { left?: string; top?: string; stamped?: boolean }) => {
      const overlayContainer = document.getElementById('svg-overlays');
      if (!overlayContainer) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'ai-diagram-overlay';
      wrapper.style.cssText = 'position:absolute;top:' + (opts?.top || '60px') + ';left:' + (opts?.left || '40px') + ';z-index:9999;border:2.5px dashed #7c3aed;border-radius:10px;background:rgba(255,255,255,0.95);overflow:visible;box-shadow:0 8px 32px rgba(124,58,237,0.18);';

      const toolbar = document.createElement('div');
      toolbar.className = 'ai-diagram-toolbar';
      toolbar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:linear-gradient(90deg,#4f46e5,#7c3aed);padding:6px 10px;cursor:grab;border-radius:8px 8px 0 0;gap:8px;';
      const moveLabel = document.createElement('span');
      moveLabel.style.cssText = 'color:#fff;font-size:11px;font-weight:bold;pointer-events:none;';
      moveLabel.textContent = '☁️ AI চিত্র — টেনে সরান';
      const btnGroup = document.createElement('div');
      btnGroup.style.cssText = 'display:flex;gap:6px;';
      const stampBtn = document.createElement('button');
      stampBtn.innerHTML = '📌 স্থায়ী';
      stampBtn.style.cssText = 'background:#22c55e;color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:bold;cursor:pointer;';
      const delBtn = document.createElement('button');
      delBtn.innerHTML = '✕';
      delBtn.style.cssText = 'background:#ef4444;color:#fff;border:none;border-radius:6px;padding:3px 8px;font-size:12px;font-weight:bold;cursor:pointer;';
      btnGroup.appendChild(stampBtn);
      btnGroup.appendChild(delBtn);
      toolbar.appendChild(moveLabel);
      toolbar.appendChild(btnGroup);

      const svgDiv = document.createElement('div');
      svgDiv.innerHTML = svgString;
      const svgEl = svgDiv.querySelector('svg');
      if (svgEl) {
        const maxW = Math.min(canvas.width * 0.85, 1000);
        svgEl.setAttribute('width', String(maxW));
        svgEl.setAttribute('height', String(Math.round(maxW * 760 / 1300)));
        svgEl.style.display = 'block';
        svgEl.style.cursor = 'pointer';
      }
      svgDiv.style.pointerEvents = 'auto';

      wrapper.appendChild(toolbar);
      wrapper.appendChild(svgDiv);
      overlayContainer.appendChild(wrapper);

      // ---- Popup helper ----
      const showPartDetailPopup2 = (partName: string, partDesc: string, clientX: number, clientY: number) => {
        const popup = document.createElement('div');
        popup.className = 'ai-part-detail-popup';
        const canvasRect = canvas.getBoundingClientRect();
        const popX = Math.max(20, Math.min(canvasRect.width - 340, (clientX - canvasRect.left) / currentScale + 15));
        const popY = Math.max(20, Math.min(canvasRect.height - 240, (clientY - canvasRect.top) / currentScale + 15));
        popup.style.cssText = `position:absolute;left:${popX}px;top:${popY}px;width:300px;background:#ffffff;border:2px solid #6366f1;border-radius:12px;box-shadow:0 12px 35px rgba(0,0,0,0.25);z-index:10000;user-select:none;font-family:'Kalpurush',sans-serif;overflow:hidden;animation:fadeInWidget 0.2s ease-out;pointer-events:auto;`;
        const popHeader = document.createElement('div');
        popHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:8px 12px;cursor:grab;color:#fff;';
        const popTitle = document.createElement('span');
        popTitle.style.cssText = 'font-weight:bold;font-size:13px;';
        popTitle.textContent = '🔍 ' + partName;
        const popClose = document.createElement('button');
        popClose.textContent = '✕';
        popClose.style.cssText = 'background:rgba(255,255,255,0.2);border:none;color:#fff;width:22px;height:22px;border-radius:50%;font-size:12px;cursor:pointer;font-weight:bold;display:flex;align-items:center;justify-content:center;pointer-events:auto;';
        popHeader.appendChild(popTitle);
        popHeader.appendChild(popClose);
        const popBody = document.createElement('div');
        popBody.style.cssText = 'padding:12px;font-size:12px;line-height:1.7;color:#334155;max-height:160px;overflow-y:auto;';
        popBody.textContent = partDesc;
        const popFooter = document.createElement('div');
        popFooter.style.cssText = 'display:flex;gap:8px;padding:8px 12px;border-top:1px solid #e2e8f0;background:#f8fafc;';
        const popStampBtn = document.createElement('button');
        popStampBtn.innerHTML = '📌 স্থায়ী করুন';
        popStampBtn.style.cssText = 'flex:1;background:#4f46e5;color:#fff;border:none;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:bold;cursor:pointer;pointer-events:auto;';
        const popCloseBtn = document.createElement('button');
        popCloseBtn.textContent = '✕ বন্ধ';
        popCloseBtn.style.cssText = 'flex:1;background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:11px;cursor:pointer;pointer-events:auto;';
        const popVoiceBtn = document.createElement('button');
        popVoiceBtn.innerHTML = '🔊 শুনুন';
        popVoiceBtn.style.cssText = 'flex:1;background:#0ea5e9;color:#fff;border:none;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:bold;cursor:pointer;pointer-events:auto;';
        popVoiceBtn.onclick = () => {
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(partName + '। ' + partDesc);
            utt.lang = 'bn-BD';
            utt.rate = 0.9;
            window.speechSynthesis.speak(utt);
          }
        };
        popVoiceBtn.onpointerdown = (e) => e.stopPropagation();
        popFooter.appendChild(popStampBtn);
        popFooter.appendChild(popVoiceBtn);
        popFooter.appendChild(popCloseBtn);
        popup.appendChild(popHeader);
        popup.appendChild(popBody);
        popup.appendChild(popFooter);
        const canvasContEl = document.getElementById('canvas-container');
        if (canvasContEl) canvasContEl.appendChild(popup);
        const closePopup = () => popup.remove();
        popClose.onclick = closePopup;
        popCloseBtn.onclick = closePopup;
        popClose.onpointerdown = (e) => e.stopPropagation();
        popCloseBtn.onpointerdown = (e) => e.stopPropagation();
        const handlePopStamp = () => {
          const popupImg = new Image();
          popupImg.onload = () => {
            const pr = popup.getBoundingClientRect();
            const cr = canvas.getBoundingClientRect();
            const px = (pr.left - cr.left) / currentScale;
            const py = (pr.top - cr.top) / currentScale;
            ctx.drawImage(popupImg, px, py, pr.width / currentScale, pr.height / currentScale);
            saveState();
          };
          const html = popup.outerHTML;
          const svg2 = '<svg xmlns="http://www.w3.org/2000/svg" width="' + popup.offsetWidth + '" height="' + popup.offsetHeight + '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">' + html + '</div></foreignObject></svg>';
          const blob3 = new Blob([svg2], { type: 'image/svg+xml;charset=utf-8' });
          const url3 = URL.createObjectURL(blob3);
          popupImg.src = url3;
          closePopup();
        };
        popStampBtn.onclick = handlePopStamp;
        popStampBtn.onpointerdown = (e) => e.stopPropagation();
        // Drag popup
        let popDragging = false, popSX = 0, poSY = 0, popLX = 0, popLY = 0;
        popHeader.onpointerdown = (e) => { if ((e.target as HTMLElement).tagName === 'BUTTON') return; popDragging = true; popSX = e.clientX; poSY = e.clientY; popLX = popup.offsetLeft; popLY = popup.offsetTop; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); };
        popHeader.onpointermove = (e) => { if (!popDragging) return; popup.style.left = (popLX + (e.clientX - popSX) / currentScale) + 'px'; popup.style.top = (popLY + (e.clientY - poSY) / currentScale) + 'px'; };
        popHeader.onpointerup = (e) => { popDragging = false; try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} };
      };

      // ---- Click detection ----
      let isDragging2 = false;
      const handleDiagramClick2 = (e: MouseEvent) => {
        if (isDragging2) return;
        const target = e.target as SVGElement;
        if (!target) return;
        
        // 1. Element with data attributes
        const interactiveEl = target.closest('[data-name], [data-desc]') as SVGElement | null;
        let name = interactiveEl?.getAttribute('data-name');
        let desc = interactiveEl?.getAttribute('data-desc');

        // 2. Closest text element
        if (!name) {
          const textEl = target.closest('text') as SVGTextElement | null;
          if (textEl) {
            name = textEl.textContent?.trim() || '';
            if (name.includes('(')) name = name.split('(')[0].trim();
            desc = textEl.getAttribute('data-desc') || (name + ' হলো এই চিত্রের একটি গুরুত্বপূর্ণ কার্যকরী অংশ।');
          }
        }

        // 3. Closest group element or sibling label
        if (!name) {
          const gEl = target.closest('g') as SVGGElement | null;
          if (gEl) {
            name = gEl.getAttribute('data-name') || gEl.querySelector('text')?.textContent?.trim() || '';
            if (name.includes('(')) name = name.split('(')[0].trim();
            desc = gEl.getAttribute('data-desc') || (name ? name + ' হলো এই চিত্রের একটি গুরুত্বপূর্ণ অংশ।' : '');
          }
        }

        // 4. Fallback: inspect any text inside the SVG
        if (!name) {
          const svgParent = target.closest('svg');
          if (svgParent) {
            const allTexts = Array.from(svgParent.querySelectorAll('text'));
            if (allTexts.length > 0) {
              const firstTxt = allTexts[0].textContent?.trim() || '';
              if (firstTxt) {
                name = firstTxt.includes('(') ? firstTxt.split('(')[0].trim() : firstTxt;
                desc = name + ' হলো এই চিত্রের একটি অংশ।';
              }
            }
          }
        }

        if (name && name.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          if (!desc) desc = name + ' হলো এই চিত্রের একটি অত্যন্ত গুরুত্বপূর্ণ ও কার্যকরী অংশ।';
          showPartDetailPopup2(name, desc, e.clientX, e.clientY);
        }
      };
      svgDiv.addEventListener('click', handleDiagramClick2, true);
      svgDiv.addEventListener('pointerup', (e: PointerEvent) => { if (!isDragging2) handleDiagramClick2(e as unknown as MouseEvent); }, true);

      // ---- Drag (toolbar only) ----
      let startCX = 0, startCY = 0, startL = 0, startT = 0;
      const onPD = (e: PointerEvent) => { if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) return; isDragging2 = true; startCX = e.clientX; startCY = e.clientY; startL = wrapper.offsetLeft; startT = wrapper.offsetTop; toolbar.style.cursor = 'grabbing'; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation(); };
      const onPM = (e: PointerEvent) => { if (!isDragging2) return; wrapper.style.left = (startL + (e.clientX - startCX) / currentScale) + 'px'; wrapper.style.top = (startT + (e.clientY - startCY) / currentScale) + 'px'; };
      const onPU = (e: PointerEvent) => { if (isDragging2) { isDragging2 = false; toolbar.style.cursor = 'grab'; try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} } };
      toolbar.addEventListener('pointerdown', onPD);
      toolbar.addEventListener('pointermove', onPM);
      toolbar.addEventListener('pointerup', onPU);

      // ---- Delete ----
      delBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); wrapper.remove(); };
      delBtn.onpointerdown = (e) => e.stopPropagation();

      // ---- Stamp to canvas ----
      const handleStamp2 = (e: Event) => {
        e.preventDefault(); e.stopPropagation();
        toolbar.style.display = 'none';
        wrapper.style.border = 'none'; wrapper.style.boxShadow = 'none'; wrapper.style.background = 'transparent'; wrapper.style.cursor = 'default';
        const el2 = wrapper.querySelector('svg');
        if (el2) {
          const ser = new XMLSerializer().serializeToString(el2);
          const blob2 = new Blob([ser], { type: 'image/svg+xml;charset=utf-8' });
          const url2 = URL.createObjectURL(blob2);
          const stamp2 = new Image();
          stamp2.onload = () => { const cr = canvas.getBoundingClientRect(); const wr = wrapper.getBoundingClientRect(); ctx.drawImage(stamp2, (wr.left - cr.left) / currentScale, (wr.top - cr.top) / currentScale, (el2.clientWidth || el2.getBoundingClientRect().width) / currentScale, (el2.clientHeight || el2.getBoundingClientRect().height) / currentScale); saveState(); URL.revokeObjectURL(url2); };
          stamp2.src = url2;
        } else saveState();
      };
      stampBtn.onclick = handleStamp2;
      stampBtn.onpointerdown = (e) => e.stopPropagation();

      // If restored in stamped state, immediately hide toolbar
      if (opts?.stamped) {
        toolbar.style.display = 'none';
        wrapper.style.border = 'none'; wrapper.style.boxShadow = 'none'; wrapper.style.background = 'transparent'; wrapper.style.cursor = 'default';
      }
    };

    
    // AI Diagram Draw: Generate SVG from text description and render on canvas
    const handleToggleAiDraw = (e?: Event) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const widget = document.getElementById('ai-draw-widget');
      if (widget) {
        widget.classList.toggle('hidden');
        if (!widget.classList.contains('hidden')) {
          const input = document.getElementById('ai-draw-input') as HTMLInputElement | null;
          if (input) input.focus();
        }
      }
    };
    if (aiDrawBtn) {
      aiDrawBtn.onclick = handleToggleAiDraw;
    }
    const btnFromDOM = document.getElementById('ai-draw-btn');
    if (btnFromDOM && btnFromDOM !== aiDrawBtn) {
      btnFromDOM.onclick = handleToggleAiDraw;
    }

    const aiDrawDoBtn = document.getElementById('ai-draw-do-btn')!;
    const aiDrawInput = document.getElementById('ai-draw-input') as HTMLInputElement;
    const aiDrawStatus = document.getElementById('ai-draw-status')!;

    // Allow Enter key to trigger AI diagram generation (works on both keydown and keypress)
    const triggerAiDraw = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        aiDrawDoBtn.click();
      }
    };
    aiDrawInput.addEventListener('keydown', triggerAiDraw);
    aiDrawInput.addEventListener('keypress', triggerAiDraw);

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
          svgRoot.setAttribute('width', '1300');
          svgRoot.setAttribute('height', '760');
          if (!svgRoot.getAttribute('viewBox')) svgRoot.setAttribute('viewBox', '0 0 1300 760');
          safeSvg = new XMLSerializer().serializeToString(svgRoot);
        } catch (e) {
          console.warn('SVG parse error:', e);
        }

        // Create interactive diagram overlay using the unified function
        createInteractiveDiagramOverlay(safeSvg);

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
              let combinedStream = stream;
              try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const tracks = [...stream.getVideoTracks(), ...audioStream.getAudioTracks()];
                combinedStream = new MediaStream(tracks);
              } catch { /* মাইক্রোফোন না থাকলে শুধু ভিডিও */ }
              mediaRecorder = new MediaRecorder(combinedStream);
              chunks = [];
              mediaRecorder.ondataavailable = (e: any) => chunks.push(e.data);
              mediaRecorder.onstop = () => {
                  combinedStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
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

    const graphPlotBtn = document.getElementById('graph-plot-btn');
    if (graphPlotBtn) {
      graphPlotBtn.onclick = () => {
        const rawExpr = mathLatexInput.value.trim();
        const expr = rawExpr.replace(/^(y|f\(x\))\s*=\s*/i, '');
        if (!expr) { alert('একটি সমীকরণ লিখুন (যেমন: y = x^2 বা y = sin(x))'); return; }
        const W = canvas.width, H = canvas.height;
        const cx = W / 2, cy = H / 2, scale = 40;
        ctx.save();
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
        for (let gx = cx % scale; gx < W; gx += scale) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
        for (let gy = cy % scale; gy < H; gy += scale) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }
        ctx.fillStyle = '#475569'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        for (let i = -Math.floor(cx/scale); i <= Math.floor((W-cx)/scale); i++) {
          if (i !== 0) ctx.fillText(String(i), cx + i*scale, cy + 12);
        }
        ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 2; ctx.beginPath();
        let first = true;
        const evalFn = (xVal: number): number => {
          try {
            const clean = expr
              .replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos')
              .replace(/tan/g, 'Math.tan').replace(/sqrt/g, 'Math.sqrt')
              .replace(/abs/g, 'Math.abs').replace(/log/g, 'Math.log')
              .replace(/pi/gi, 'Math.PI').replace(/\\^/g, '**')
              .replace(/x/g, String(xVal));
            return Function('"use strict"; return (' + clean + ')')() as number;
          } catch { return NaN; }
        };
        for (let px = 0; px < W; px++) {
          const xVal = (px - cx) / scale;
          const yVal = evalFn(xVal);
          if (isNaN(yVal) || !isFinite(yVal)) { first = true; continue; }
          const pyCoord = cy - yVal * scale;
          if (first) { ctx.moveTo(px, pyCoord); first = false; } else ctx.lineTo(px, pyCoord);
        }
        ctx.stroke(); ctx.restore();
        saveState();
        mathWidget.classList.add('hidden');
      };
    }

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

    // Realistic 3D Board Viewer (Generates 3D Textured Model of Current Board)
    const view3dBtn = document.getElementById('view-3d-btn');
    const modal3d = document.getElementById('modal-3d');
    const close3d = document.getElementById('close-3d');
    const container3d = document.getElementById('container-3d');
    let threeAnimationId: number | null = null;
    let threeRenderer: any = null;

    if (view3dBtn && modal3d && close3d && container3d) {
      view3dBtn.onclick = async () => {
        modal3d.classList.remove('hidden');
        if (!(window as any).THREE) {
          container3d.innerHTML = '<div style="color:white;display:flex;align-items:center;justify-content:center;height:100%;font-weight:bold;">৩ডি লাইব্রেরি (Three.js) লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</div>';
          return;
        }

        container3d.innerHTML = '<div style="color:#38bdf8;display:flex;align-items:center;justify-content:center;height:100%;font-weight:bold;gap:8px;"><span>🌀 ৩ডি মডেল প্রস্তুত হচ্ছে...</span></div>';

        // 1. Snapshot board canvas
        const fullRenderCanvas = document.createElement('canvas');
        fullRenderCanvas.width = canvas.width;
        fullRenderCanvas.height = canvas.height;
        const frCtx = fullRenderCanvas.getContext('2d');
        if (!frCtx) return;

        // Draw whiteboard canvas
        frCtx.drawImage(canvas, 0, 0);

        // Draw any active SVG overlays asynchronously
        const overlayWrappers = Array.from(document.querySelectorAll('.ai-diagram-overlay'));
        for (const w of overlayWrappers) {
          const svgEl = w.querySelector('svg');
          if (svgEl) {
            const wr = (w as HTMLElement).getBoundingClientRect();
            const cr = canvas.getBoundingClientRect();
            const sx = (wr.left - cr.left) / currentScale;
            const sy = (wr.top - cr.top) / currentScale;
            const dw = (svgEl.clientWidth || svgEl.getBoundingClientRect().width) / currentScale;
            const dh = (svgEl.clientHeight || svgEl.getBoundingClientRect().height) / currentScale;
            const ser = new XMLSerializer().serializeToString(svgEl);
            const blob = new Blob([ser], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            await new Promise<void>((resolve) => {
              const tempImg = new Image();
              tempImg.onload = () => {
                frCtx.drawImage(tempImg, sx, sy, dw, dh);
                URL.revokeObjectURL(url);
                resolve();
              };
              tempImg.onerror = () => {
                URL.revokeObjectURL(url);
                resolve();
              };
              tempImg.src = url;
            });
          }
        }

        container3d.innerHTML = '';
        const THREE = (window as any).THREE;
        const width = container3d.clientWidth || 620;
        const height = container3d.clientHeight || 440;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f172a);

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 0, 4.4);

        threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        threeRenderer.setSize(width, height);
        threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container3d.appendChild(threeRenderer.domElement);

        // Studio lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(3, 4, 5);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.6);
        fillLight.position.set(-4, -2, 3);
        scene.add(fillLight);

        // Texture
        const texture = new THREE.CanvasTexture(fullRenderCanvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;

        const aspect = canvas.width / canvas.height;
        const boardW = 3.3;
        const boardH = boardW / aspect;
        const depth = 0.14;

        // Front Face (Whiteboard drawing)
        const frontGeo = new THREE.PlaneGeometry(boardW, boardH);
        const frontMat = new THREE.MeshBasicMaterial({ map: texture });
        const frontMesh = new THREE.Mesh(frontGeo, frontMat);
        frontMesh.position.z = depth / 2 + 0.002;

        // Realistic Whiteboard Body / Stand
        const bodyGeo = new THREE.BoxGeometry(boardW + 0.08, boardH + 0.08, depth);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.35,
          metalness: 0.7
        });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);

        // Shiny Bezel Trim around board
        const frameGeo = new THREE.BoxGeometry(boardW + 0.14, boardH + 0.14, depth * 0.9);
        const frameMat = new THREE.MeshStandardMaterial({
          color: 0x4f46e5,
          roughness: 0.25,
          metalness: 0.85
        });
        const frameMesh = new THREE.Mesh(frameGeo, frameMat);

        const main3DGroup = new THREE.Group();
        main3DGroup.add(bodyMesh);
        main3DGroup.add(frameMesh);
        main3DGroup.add(frontMesh);

        // Tilt slightly towards camera for instant 3D look
        main3DGroup.rotation.x = 0.12;
        main3DGroup.rotation.y = -0.22;
        scene.add(main3DGroup);

        // Mouse Drag to Rotate 360
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
          main3DGroup.rotation.y += deltaX * 0.009;
          main3DGroup.rotation.x += deltaY * 0.009;
          prevMouseX = e.clientX;
          prevMouseY = e.clientY;
        };

        // Touch drag
        let prevTouchX = 0, prevTouchY = 0;
        container3d.ontouchstart = (e: TouchEvent) => {
          if (e.touches.length === 1) {
            prevTouchX = e.touches[0].clientX;
            prevTouchY = e.touches[0].clientY;
          }
        };
        container3d.ontouchmove = (e: TouchEvent) => {
          if (e.touches.length === 1) {
            const dx = e.touches[0].clientX - prevTouchX;
            const dy = e.touches[0].clientY - prevTouchY;
            main3DGroup.rotation.y += dx * 0.009;
            main3DGroup.rotation.x += dy * 0.009;
            prevTouchX = e.touches[0].clientX;
            prevTouchY = e.touches[0].clientY;
          }
        };

        // Scroll wheel to Zoom
        container3d.onwheel = (e: WheelEvent) => {
          e.preventDefault();
          camera.position.z = Math.max(1.8, Math.min(8.0, camera.position.z + e.deltaY * 0.003));
        };

        const animate = () => {
          threeAnimationId = requestAnimationFrame(animate);
          if (!isDragging3D) {
            main3DGroup.rotation.y += 0.003;
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
    savePdfBtn.onclick = async () => {
        if (!(window as any).jspdf) {
          alert('PDF জেনারেটর প্রস্তুত হচ্ছে...');
          return;
        }
        pagesData[currentBoardPage].imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pdf = new (window as any).jspdf.jsPDF('l', 'px', [canvas.width, canvas.height]);
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = canvas.width; tmpCanvas.height = canvas.height;
        const tmpCtx = tmpCanvas.getContext('2d')!;
        for (let pi = 0; pi < pagesData.length; pi++) {
          if (pi > 0) pdf.addPage([canvas.width, canvas.height], 'l');
          tmpCtx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
          tmpCtx.fillStyle = '#ffffff'; tmpCtx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
          if (pagesData[pi].imageData) tmpCtx.putImageData(pagesData[pi].imageData, 0, 0);
          tmpCtx.fillStyle = 'rgba(79,70,229,0.08)';
          tmpCtx.fillRect(0, 0, tmpCanvas.width, 28);
          tmpCtx.fillStyle = '#4f46e5';
          tmpCtx.font = 'bold 13px Kalpurush, sans-serif';
          tmpCtx.fillText('\ud83d\udcd2 স্মার্ট হোয়ার্টবোর্ড  |  পেজ ' + (pi + 1) + ' / ' + pagesData.length, 10, 18);
          pdf.addImage(tmpCanvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
        }
        pdf.save('whiteboard_all_pages.pdf');
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

    // Saved Boards Library Logic (Firebase Firestore Cloud + IndexedDB offline backup)
    const savedBoardsBtn = document.getElementById('saved-boards-btn');
    const savedBoardsModal = document.getElementById('saved-boards-modal');
    const closeSavedBoardsBtn = document.getElementById('close-saved-boards-modal');
    const saveCurrentToLibBtn = document.getElementById('save-current-to-library-btn');
    const savedBoardsList = document.getElementById('saved-boards-list');

    // ---- Firestore helpers (lazy-loaded to avoid SSR issues) ----
    const getFirestoreDB = async () => {
      const { getFirestore } = await import('firebase/firestore');
      const app = getFirebaseApp();
      return getFirestore(app);
    };

    const COLLECTION = 'whiteboard_boards';

    const loadBoardsFromFirestore = async (): Promise<any[]> => {
      try {
        const { collection, getDocs, orderBy, query } = await import('firebase/firestore');
        const db = await getFirestoreDB();
        const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.warn('Firestore load error:', e);
        return [];
      }
    };

    const saveBoardToFirestore = async (item: { title: string; image: string; thumb: string; overlays?: any[] }): Promise<string | null> => {
      try {
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
        const db = await getFirestoreDB();
        const ref = await addDoc(collection(db, COLLECTION), {
          title: item.title,
          image: item.image,
          thumb: item.thumb,
          overlays: item.overlays || [],
          createdAt: serverTimestamp(),
        });
        return ref.id;
      } catch (e) {
        console.warn('Firestore save error:', e);
        return null;
      }
    };

    const deleteBoardFromFirestore = async (id: string): Promise<void> => {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const db = await getFirestoreDB();
        await deleteDoc(doc(db, COLLECTION, id));
      } catch (e) {
        console.warn('Firestore delete error:', e);
      }
    };

    // ---- IndexedDB helpers (offline backup) ----
    const IDB_NAME = 'MyBookWhiteboardDB';
    const IDB_STORE = 'saved_boards';

    const openIDB = (): Promise<IDBDatabase> => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    };

    const saveToIDB = async (item: any) => {
      try {
        const db = await openIDB();
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(item);
      } catch (e) { console.warn('IDB save error:', e); }
    };

    const deleteFromIDB = async (id: string) => {
      try {
        const db = await openIDB();
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(id);
      } catch (e) { console.warn('IDB delete error:', e); }
    };

    const loadFromIDB = async (): Promise<any[]> => {
      try {
        const db = await openIDB();
        return new Promise((resolve) => {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).getAll();
          req.onsuccess = () => resolve((req.result || []).reverse());
          req.onerror = () => resolve([]);
        });
      } catch { return []; }
    };

    // ---- Unified board loader: Firestore first, IDB fallback ----
    const getSavedBoards = async (): Promise<any[]> => {
      const fsBoards = await loadBoardsFromFirestore();
      if (fsBoards.length > 0) {
        return fsBoards.map((b: any) => ({
          id: b.id,
          title: b.title,
          image: b.image,
          thumb: b.thumb,
          overlays: b.overlays || [],
          date: b.createdAt?.toDate ? b.createdAt.toDate().toISOString() : b.createdAt || new Date().toISOString(),
          isCloud: true,
        }));
      }
      // Firestore empty or offline — fall back to local
      const localBoards = await loadFromIDB();
      return localBoards.map((b: any) => ({ ...b, overlays: b.overlays || [], isCloud: false }));
    };

    // ---- Render the saved boards list ----
    const renderSavedBoardsList = async () => {
      if (!savedBoardsList) return;
      savedBoardsList.innerHTML = '<p class="text-center text-xs text-slate-500 py-8">লোড হচ্ছে...</p>';
      const list = await getSavedBoards();
      if (list.length === 0) {
        savedBoardsList.innerHTML = '<p class="text-center text-xs text-slate-500 py-8">কোনো সংরক্ষিত পেজ পাওয়া যায়নি। উপরের বাটন দিয়ে সংরক্ষণ করুন।</p>';
        return;
      }
      savedBoardsList.innerHTML = '';
      list.forEach((item: any, idx: number) => {
        const itemCard = document.createElement('div');
        itemCard.className = 'flex items-center justify-between p-3 border rounded-xl hover:border-amber-400 bg-slate-50/70 transition-all';
        itemCard.innerHTML = `
          <div class="flex items-center gap-3">
            <img src="${item.thumb}" class="w-16 h-12 object-cover rounded-md border border-slate-300 shadow-sm" alt="Preview" />
            <div>
              <div class="flex items-center gap-1.5">
                <p class="font-bold text-xs text-slate-900">${item.title || 'হোয়াইটবোর্ড পেজ ' + (idx + 1)}</p>
                <span class="text-[9px] px-1.5 py-0.5 rounded font-bold ${item.isCloud ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-blue-100 text-blue-700'}">
                  ${item.isCloud ? '☁️ ক্লাউড' : '💾 লোকাল'}
                </span>
              </div>
              <p class="text-[10px] text-slate-500">${new Date(item.date).toLocaleString('bn-BD')}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button class="load-board-btn px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold transition-colors" data-id="${item.id}">
              📂 খুলুন
            </button>
            <button class="del-board-btn px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-md text-xs font-bold transition-colors" data-id="${item.id}" data-cloud="${item.isCloud}">
              🗑️
            </button>
          </div>
        `;
        savedBoardsList.appendChild(itemCard);
      });

      savedBoardsList.querySelectorAll('.load-board-btn').forEach(btn => {
        (btn as HTMLElement).onclick = async (e) => {
          const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
          const currentList = await getSavedBoards();
          const item = currentList.find(b => String(b.id) === String(id));
          if (item && item.image) {
            const img = new Image();
            img.onload = () => {
              saveState();
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              drawBackground();
              ctx.drawImage(img, 0, 0);
              saveState();
              // Restore interactive SVG overlays to current page
              if (pagesData[currentBoardPage]) {
                pagesData[currentBoardPage].overlays = item.overlays || [];
              }
              const oc = document.getElementById('svg-overlays');
              if (oc) oc.innerHTML = '';
              if (item.overlays && Array.isArray(item.overlays)) {
                item.overlays.forEach((ov: any) => {
                  createInteractiveDiagramOverlay(ov.svg, { left: ov.left, top: ov.top, stamped: ov.stamped });
                });
              }
              savedBoardsModal?.classList.add('hidden');
            };
            img.src = item.image;
          }
        };
      });

      savedBoardsList.querySelectorAll('.del-board-btn').forEach(btn => {
        (btn as HTMLElement).onclick = async (e) => {
          const el = e.currentTarget as HTMLElement;
          const id = el.getAttribute('data-id');
          const isCloud = el.getAttribute('data-cloud') === 'true';
          if (!id || !confirm('পেজটি মুছে ফেলবেন?')) return;
          if (isCloud) {
            await deleteBoardFromFirestore(id);
          } else {
            await deleteFromIDB(id);
          }
          renderSavedBoardsList();
        };
      });
    };

    if (savedBoardsBtn && savedBoardsModal) {
      savedBoardsBtn.onclick = () => {
        savedBoardsModal.classList.toggle('hidden');
        if (!savedBoardsModal.classList.contains('hidden')) {
          renderSavedBoardsList();
        }
      };
    }

    if (closeSavedBoardsBtn && savedBoardsModal) {
      closeSavedBoardsBtn.onclick = () => savedBoardsModal.classList.add('hidden');
    }

    if (saveCurrentToLibBtn) {
      saveCurrentToLibBtn.onclick = async () => {
        const titlePrompt = prompt('পেজের একটি নাম দিন:', 'লেকচার ' + new Date().toLocaleDateString('bn-BD'));
        if (!titlePrompt) return;

        try {
          // Collect active SVG overlays (for restoring click logic after load)
          const overlays: any[] = [];
          document.querySelectorAll('.ai-diagram-overlay').forEach((wrapper) => {
            const svgEl = wrapper.querySelector('svg');
            if (svgEl) {
              const rect = (wrapper as HTMLElement).style;
              const toolbar = wrapper.querySelector('.ai-diagram-toolbar') as HTMLElement | null;
              overlays.push({
                svg: new XMLSerializer().serializeToString(svgEl),
                left: rect.left || '40px',
                top: rect.top || '60px',
                stamped: toolbar ? toolbar.style.display === 'none' : false,
              });
            }
          });

          // Compress image to JPEG for Firestore (keep under 900KB)
          const compCanvas = document.createElement('canvas');
          compCanvas.width = canvas.width;
          compCanvas.height = canvas.height;
          const compCtx = compCanvas.getContext('2d');
          if (compCtx) compCtx.drawImage(canvas, 0, 0);
          const imageData = compCanvas.toDataURL('image/jpeg', 0.5);

          // Thumb: 160x100 JPEG
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = 200;
          thumbCanvas.height = 125;
          const thumbCtx = thumbCanvas.getContext('2d');
          if (thumbCtx) thumbCtx.drawImage(canvas, 0, 0, 200, 125);
          const thumbData = thumbCanvas.toDataURL('image/jpeg', 0.6);

          const localId = 'local_' + Date.now();

          // 1. Save to Firestore (cloud)
          const cloudId = await saveBoardToFirestore({
            title: titlePrompt.trim(),
            image: imageData,
            thumb: thumbData,
            overlays,
          });

          // 2. Also save to IndexedDB (offline fallback)
          await saveToIDB({
            id: cloudId || localId,
            title: titlePrompt.trim(),
            image: imageData,
            thumb: thumbData,
            date: new Date().toISOString(),
            overlays,
          });

          renderSavedBoardsList();
          alert(cloudId
            ? '✓ পেজটি ক্লাউডে (Firebase) সফলভাবে সংরক্ষণ করা হয়েছে!'
            : '✓ পেজটি লোকালে সংরক্ষিত হয়েছে (ক্লাউড সংযোগ ব্যর্থ)।');
        } catch (err: any) {
          alert('সংরক্ষণ ব্যর্থ হয়েছে: ' + (err?.message || err));
        }
      };
    }
    adjustScrollWrapperLayout();
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
        <button
          onClick={() => router.push('/')}
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-colors flex items-center gap-1.5 shadow-md mr-1 border border-indigo-400"
          title="হোম পোর্টালে ফিরে যান"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> পোর্টালে ফিরুন
        </button>
        <div id="tabs-wrapper"></div>
        <button id="add-board-page" className="browser-plus-btn top-plus-btn" title="নতুন পেজ">➕</button>
        <button id="delete-board-page" className="browser-delete-btn" title="ডিলিট">🗑️</button>
        <button
          id="ai-draw-btn"
          className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1 shadow-md border border-purple-400 ml-1"
          title="AI দিয়ে চিত্র আঁকুন"
        >
          🎨 AI চিত্র
        </button>
        <button id="clear">🗑️ মুছুন</button>
        <button
          id="saved-boards-btn"
          className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black transition-colors flex items-center gap-1 shadow-md border border-amber-400 ml-1"
          title="সংরক্ষিত হোয়াইটবোর্ড পেজগুলো দেখুন ও লোড করুন"
        >
          📁 সংরক্ষিত পেজ
        </button>
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
          <div id="svg-overlays" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}></div>
        </div>
      </div>

      <div id="modal-3d" className="hidden">
        <div className="modal-content">
          <span id="close-3d" title="বন্ধ করুন">&times;</span>
          <h4 style={{ color: 'white', fontWeight: 'bold', marginBottom: '10px' }}>🧊 বর্তমান বোর্ডের বাস্তব ৩ডি মডেল ভিউয়ার (মাউস দিয়ে ঘোরান ও জুম করুন)</h4>
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
        <button id="graph-plot-btn" style={{ width: '100%', marginTop: '5px', background:'#2563eb', color:'white', padding:'8px', borderRadius:'6px' }}>📈 গ্রাফ আঁকুন</button>
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
          <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'8px' }}>
            {['উদ্ভিদ কোষ','প্রাণী কোষ','মানব হৃদপিণ্ড','পরমাণুর গঠন','DNA গঠন','পানি চক্র'].map((preset) => (
              <button key={preset} onClick={() => {
                const inp = document.getElementById('ai-draw-input') as HTMLTextAreaElement;
                if (inp) { inp.value = preset; inp.dispatchEvent(new Event('input')); }
              }} style={{ padding:'3px 8px', background:'#ede9fe', color:'#5b21b6', border:'1px solid #c4b5fd', borderRadius:'12px', fontSize:'10px', fontWeight:'bold', cursor:'pointer' }}>{preset}</button>
            ))}
          </div>
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


      {/* Saved Boards Library Modal */}
      <div id="saved-boards-modal" className="widget hidden flex flex-col p-0" style={{ width: '640px', maxWidth: '94vw', height: '520px', zIndex: 10025 }}>
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 p-3.5 text-white flex justify-between items-center shadow-md">
          <h4 className="font-black text-sm md:text-base flex items-center gap-2">
            📁 সংরক্ষিত হোয়াইটবোর্ড পেজ লাইব্রেরি
          </h4>
          <button id="close-saved-boards-modal" className="text-white hover:text-amber-200 transition-colors p-1 rounded-lg text-lg font-bold">
            ✕
          </button>
        </div>
        <div className="p-3 bg-amber-50/50 border-b flex justify-between items-center">
          <span className="text-xs font-bold text-slate-700">বর্তমান পেজটি তালিকায় সেভ করে রাখতে ডানপাশের বাটন চাপুন:</span>
          <button id="save-current-to-library-btn" className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow-sm flex items-center gap-1">
            💾 বর্তমান পেজ সেভ করুন
          </button>
        </div>
        <div id="saved-boards-list" className="p-4 overflow-y-auto flex-1 bg-white text-slate-900 space-y-3">
          <p className="text-center text-xs text-slate-500 py-8">কোনো সংরক্ষিত পেজ পাওয়া যায়নি।</p>
        </div>
      </div>
    </div>
  );
}
