'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { ArrowLeft, XCircle, BrainCircuit } from 'lucide-react';
import './whiteboard.css';

export default function WhiteboardPage() {
  const router = useRouter();
  const [scriptsLoaded, setScriptsLoaded] = useState(0);
  const totalScripts = 7;
  const isInitialized = useRef(false);

  const handleScriptLoad = () => {
    setScriptsLoaded((prev) => prev + 1);
  };

  useEffect(() => {
    if (scriptsLoaded < totalScripts || isInitialized.current) return;

    const canvas = document.getElementById('board') as HTMLCanvasElement;
    if (!canvas) return;
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
    const resetViewBtn = document.getElementById('reset-view-btn')!;

    const pdfUpload = document.getElementById('pdf-upload') as HTMLInputElement;
    const uploadBtn = document.getElementById('upload-btn')!;
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

    const modal3D = document.getElementById('modal-3d')!;
    const view3DBtn = document.getElementById('view-3d-btn')!;
    const close3DBtn = document.getElementById('close-3d')!;
    const container3D = document.getElementById('container-3d')!;

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
    let freehandPoints: {x: number, y: number}[] = [];
    let undoStack: ImageData[] = [];
    let redoStack: ImageData[] = [];
    const MAX_HISTORY = 20;

    let pagesData: any[] = [{
      imageData: null,
      pdfDoc: null,
      pageNum: 1,
      numPages: 0
    }];
    let currentBoardPage = 0;

    canvas.width = Math.min(window.innerWidth - 60, 2000);
    canvas.height = Math.max(window.innerHeight - 120, 1200);

    function parseSubjectTeacher(cell: string): { subject: string, teacher: string | null } {
      if (!cell) return { subject: '', teacher: null };
      const trimmedCell = cell.trim();
      if (!trimmedCell.includes(' - ')) {
        return { subject: trimmedCell, teacher: null };
      }
      const parts = trimmedCell.split(' - ');
      const teacher = parts.pop()?.trim() || null;
      const subject = parts.join(' - ').trim();
      return { subject, teacher };
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
        const autoSaveData = { image: canvas.toDataURL(), bg: currentBgStyle, date: new Date().toISOString() };
        localStorage.setItem('whiteboard_autosave_data', JSON.stringify(autoSaveData));
        if (syncText) syncText.textContent = '☁️ অটো-সেভ সম্পন্ন';
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
      isDrawing = false; ctx.beginPath();
    }

    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);

    const toggleSidebarHandler = () => {
      toolbar.classList.toggle('collapsed');
      toggleSidebarBtn.textContent = toolbar.classList.contains('collapsed') ? '▶' : '◀';
    };
    toggleSidebarBtn.addEventListener('click', toggleSidebarHandler);

    const toggleRightSidebarHandler = () => {
      rightToolbar.classList.toggle('collapsed');
      toggleRightSidebarBtn.textContent = rightToolbar.classList.contains('collapsed') ? '◀' : '▶';
    };
    toggleRightSidebarBtn.addEventListener('click', toggleRightSidebarHandler);

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
        note.style.left = '100px'; note.style.top = '100px';
        note.innerHTML = `<span class="close-note" style="position:absolute;top:2px;right:5px;cursor:pointer;">&times;</span><textarea style="width:100%;height:100%;border:none;background:transparent;"></textarea>`;
        canvasContainer.appendChild(note);
        (note.querySelector('.close-note') as HTMLElement).onclick = () => note.remove();
    };

    ocrBtn.onclick = async () => {
        ocrBtn.textContent = '⏳...';
        const result = await (window as any).Tesseract.recognize(canvas.toDataURL(), 'ben+eng');
        alert(result.data.text || 'কিছু পাওয়া যায়নি');
        ocrBtn.textContent = '📝 OCR';
    };

    speechBtn.onclick = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return alert('ব্রাউজার সাপোর্ট করে না');
        const rec = new SpeechRecognition();
        rec.lang = 'bn-BD';
        rec.start();
        speechBtn.textContent = '🎙️...';
        rec.onresult = (e: any) => {
            const txt = e.results[0][0].transcript;
            ctx.font = '24px Kalpurush, sans-serif';
            ctx.fillStyle = colorPicker.value;
            ctx.fillText(txt, 200, 200);
            saveState();
        };
        rec.onend = () => speechBtn.textContent = '🎙️ ভয়েস';
    };

    let mediaRecorder: any, chunks: any[] = [];
    recordBtn.onclick = async () => {
        if (recordBtn.classList.contains('recording')) {
            mediaRecorder.stop();
            recordBtn.classList.remove('recording');
            recordBtn.textContent = '🎥 রেকর্ড';
        } else {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            mediaRecorder = new MediaRecorder(stream);
            chunks = [];
            mediaRecorder.ondataavailable = (e: any) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'recording.webm'; a.click();
            };
            mediaRecorder.start();
            recordBtn.classList.add('recording');
            recordBtn.textContent = '⏹️ থামান';
        }
    };

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
            img.onload = () => { ctx.drawImage(img, 100, 100); saveState(); };
        }
    };

    calcBtn.onclick = () => calcWidget.classList.toggle('hidden');
    const calcScreen = document.getElementById('calc-screen') as HTMLInputElement;
    calcWidget.querySelectorAll('.calc-buttons button').forEach(b => {
        (b as HTMLElement).onclick = () => {
            const txt = b.textContent;
            if (txt === '=') { try { calcScreen.value = eval(calcScreen.value); } catch { calcScreen.value = 'Error'; } }
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

    spotlightBtn.onclick = () => spotlightOverlay.classList.toggle('hidden');
    const spotlightMoveHandler = (e: MouseEvent) => {
        if (!spotlightOverlay.classList.contains('hidden')) {
            const rect = canvasContainer.getBoundingClientRect();
            spotlightOverlay.style.background = `radial-gradient(circle 120px at ${e.clientX - rect.left}px ${e.clientY - rect.top}px, transparent 100%, rgba(0,0,0,0.8) 100%)`;
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

    saveImgBtn.onclick = () => { const a = document.createElement('a'); a.href = canvas.toDataURL(); a.download = 'board.png'; a.click(); };
    savePdfBtn.onclick = () => {
        const pdf = new (window as any).jspdf.jsPDF('l', 'px', [canvas.width, canvas.height]);
        pdf.addImage(canvas.toDataURL(), 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('board.pdf');
    };
    
    uploadBtn.onclick = () => pdfUpload.click();
    pdfUpload.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function() {
                const typedarray = new Uint8Array(this.result as ArrayBuffer);
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

    const aiSolveBtn = document.getElementById('ai-solve-btn')!;
    const aiModal = document.getElementById('ai-modal')!;
    const aiBody = document.getElementById('ai-solution-body')!;
    const closeAiBtn = document.getElementById('close-ai-modal')!;

    aiSolveBtn.onclick = async () => {
        aiSolveBtn.textContent = '⏳...';
        try {
            const result = await (window as any).Tesseract.recognize(canvas.toDataURL(), 'ben+eng');
            const mathText = result.data.text;
            if (!mathText.trim()) { alert('বোর্ডে কোনো লেখা নেই'); }
            else {
                aiModal.classList.remove('hidden');
                aiBody.innerHTML = `<div class="p-4 bg-slate-50 rounded-xl border border-dashed"><p class="font-black text-indigo-700">শনাক্তকৃত প্রশ্ন:</p><p className="font-bold">${mathText}</p><hr className="my-4"/><p class="font-black text-emerald-700">AI সমাধান:</p><p class="text-xs">শীঘ্রই জেমিনি এআই দিয়ে পূর্ণাঙ্গ সমাধান যুক্ত করা হবে।</p></div>`;
            }
        } catch (e) { alert('AI এরর'); }
        finally { aiSolveBtn.textContent = '🤖 এআই সলভ'; }
    };

    closeAiBtn.onclick = () => aiModal.classList.add('hidden');

    drawBackground();
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
      isInitialized.current = false;
    };
  }, [scriptsLoaded, totalScripts]);

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
        <button id="math-tool-btn">{"∑</math LaTeX"}</button>
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
        </div>
      </div>

      <div id="modal-3d" className="hidden">
        <div className="modal-content">
          <span id="close-3d">&times;</span>
          <div id="container-3d"></div>
        </div>
      </div>

      <div id="ai-modal" className="widget hidden h-[400px] flex flex-col p-0">
          <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h4 className="font-black text-lg flex items-center gap-2"><BrainCircuit /> এআই সমাধান</h4>
              <button id="close-ai-modal" className="text-white hover:text-red-200 transition-colors"><XCircle /></button>
          </div>
          <div id="ai-solution-body" className="p-6 overflow-y-auto flex-1 bg-white text-black"></div>
      </div>

      <div id="calc-widget" className="widget hidden">
        <div className="widget-header">🧮 ক্যালকুলেটর <span className="close-widget" style={{cursor:'pointer'}}>&times;</span></div>
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
        <div className="widget-header">∑ ম্যাথ ইনপুট <span className="close-widget" style={{cursor:'pointer'}}>&times;</span></div>
        <input type="text" id="math-latex-input" placeholder="LaTeX..." style={{ width: '100%', padding:'5px', color:'black' }} />
        <div id="math-preview" style={{ background: '#fff', color: '#000', padding: '10px', minHeight: '40px', marginTop: '5px', borderRadius:'4px' }}></div>
        <button id="insert-math-btn" style={{ width: '100%', marginTop: '5px', background:'#27ae60', color:'white', padding:'8px' }}>যোগ করুন</button>
      </div>

      <div id="timer-widget" className="widget hidden">
        <div className="widget-header">⏱️ টাইমার <span className="close-widget" style={{cursor:'pointer'}}>&times;</span></div>
        <div id="timer-display" style={{ fontSize: '30px', textAlign: 'center', fontWeight: 'bold' }}>00:00</div>
        <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
          <button id="start-timer" style={{flex: 1, padding:'5px'}}>শুরু</button>
          <button id="stop-timer" style={{flex: 1, padding:'5px'}}>বন্ধ</button>
          <button id="reset-timer" style={{flex: 1, padding:'5px'}}>রিসেট</button>
        </div>
      </div>

      <button className="back-home-btn no-print" onClick={() => router.push('/')}>
        <ArrowLeft className="w-4 h-4" /> পোর্টালে ফিরুন
      </button>

      <input type="file" id="img-upload" accept="image/*" style={{ display: 'none' }} />
    </div>
  );
}
