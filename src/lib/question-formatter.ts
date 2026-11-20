export function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

export function stripAnswers(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[\s*(?:সঠিক\s*উত্তর|উত্তরঃ?|উত্তর)[^\]]*\]/gi, '')
    .replace(/\(\s*(?:সঠিক\s*উত্তর|উত্তরঃ?|উত্তর)[^)]*\)/gi, '')
    .replace(/(?:সঠিক\s*উত্তর|উত্তরঃ?|উত্তর)\s*:\s*[^\n]+/gi, '')
    .replace(/(?:সঠিক\s*উত্তর|উত্তরঃ?|উত্তর)\s*[:=]\s*[ক-ঘA-D1-4][^\n]*/gi, '')
    .replace(/(?:\n|^)\s*উত্তরঃ?\s*[^\n]+/gi, '')
    .replace(/(?:\n|^)\s*উত্তর\s*:[^\n]+/gi, '')
    .trim();
}

export function cleanQuestionNumbering(text: string): string {
  if (!text) return '';
  return text.replace(/^[০-৯\d]+\s*[।.)]\s*(?:[০-৯\d]+\s*[।.)]\s*)?/, '').trim();
}

function formatMath(text: string): string {
  if (!text) return '';
  let formatted = text.replace(/\$|\\\(|\\\)|\\\[|\\\]|###|\*\*/g, '');
  formatted = formatted.replace(/\(\((.*?)\)\)/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
  formatted = formatted.replace(/\\text\{([^}]+)\}/g, '<span class="math-text">$1</span>');
  const fracRegex = /\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  formatted = formatted.replace(fracRegex, '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');
  formatted = formatted.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '<span class="math-sqrt"><sup class="math-root">$1</sup>√<span class="math-sqrt-stem">$2</span></span>');
  formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, '<span class="math-sqrt">√<span class="math-sqrt-stem">$1</span></span>');
  formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/\^(\d+|[a-z]|[A-Z])/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub class="math-sub">$1</sub>');
  formatted = formatted.replace(/_(\d+|[a-z]|[A-Z])/g, '<sub class="math-sub">$1</sub>');
  const symbolMap: Record<string, string> = {
    '\\\\log': 'log', '\\\\triangle': '△', '\\\\angle': '∠', '\\\\circ': '°',
    '\\\\theta': 'θ', '\\\\pi': 'π', '\\\\pm': '±', '\\\\times': '×',
    '\\\\neq': '≠', '\\\\ne': '≠', '\\\\leq': '≤', '\\\\geq': '≥',
    '\\\\degree': '°', '\\\\cdot': '·', '\\\\infty': '∞', '\\\\approx': '≈',
    '\\\\sum': '∑', '\\\\prod': '∏', '\\\\alpha': 'α', '\\\\beta': 'β',
    '\\\\gamma': 'γ', '\\\\delta': 'δ', '\\\\sigma': 'σ', '\\\\phi': 'φ', '\\\\omega': 'ω',
    '\\\\eta': 'η', '\\\\rho': 'র', '\\\\lambda': 'λ', '\\\\mu': 'μ',
    '\\\\div': '÷', '\\\\rightarrow': '→', '\\\\to': '→', '\\\\arrow': '→',
    '\\\\in': '∈', '\\\\mathbb\{N\}': 'ℕ', '\\\\mathbb\{R\}': 'ℝ', '\\\\mathbb\{Z\}': 'ℤ',
    '\\\\mathbb\{Q\}': 'ℚ', '\\\\subset': '⊂', '\\\\subseteq': '⊆', '\\\\cup': '∪',
    '\\\\cap': '∩', '\\\\emptyset': '∅', '\\\\forall': '∀', '\\\\exists': '∃', 
    '\\\\Rightarrow': '⇒', '\\\\leftarrow': '←', '\\\\Leftarrow': '⇐', 
    '\\\\leftrightarrow': '↔', '\\\\Leftrightarrow': '⇔',
    '\\\\left': '', '\\\\right': '', '\\\\%': '%', '\\\\setminus': '\\', '\\\\backslash': '\\',
    '\\\\propto': '∝', '\\\\parallel': '∥', '\\\\perp': '⊥'
  };
  Object.entries(symbolMap).forEach(([key, val]) => { formatted = formatted.replace(new RegExp(key, 'g'), val); });
  formatted = formatted.replace(/\\dot\{([^}]+)\}/g, '<span class="math-dot">$1</span>');
  formatted = formatted.replace(/\\/g, '');
  return formatted;
}

export function parseGeneratedQuestions(rawText: string, defaultType?: 'creative' | 'short' | 'mcq'): { type: 'creative' | 'short' | 'mcq'; content: string }[] {
  const clean = stripAnswers(rawText);
  // Match question numbers at boundary: e.g. "১। ", "১. ", "\n১। "
  const regex = /(?:^|\n)\s*(?:[০-৯\d]+)\s*[।.)]\s*(?:[০-৯\d]+\s*[।.)]\s*)?/g;
  const matches: { index: number; length: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(clean)) !== null) {
    matches.push({ index: m.index, length: m[0].length });
  }

  const determineType = (text: string): 'creative' | 'short' | 'mcq' => {
    if (defaultType) return defaultType;
    const hasK = /(?:^|\n|\s)(?:\(?ক[.)\]]|\(ক\))/i.test(text);
    const hasKh = /(?:^|\n|\s)(?:\(?খ[.)\]]|\(খ\))/i.test(text);
    const hasG = /(?:^|\n|\s)(?:\(?গ[.)\]]|\(গ\))/i.test(text);
    const hasGh = /(?:^|\n|\s)(?:\(?ঘ[.)\]]|\(ঘ\))/i.test(text);

    if (hasK && hasKh && hasG && hasGh) {
      const isMcqPattern = text.includes('(ক)') || 
                           text.includes('নিচের কোনটি') || 
                           text.includes('কোনটি?') || 
                           text.includes('কত?') || 
                           text.includes('মান কত');
      const isCqPattern = text.includes('উদ্দীপক') || 
                          text.includes('প্রমাণ কর') || 
                          text.includes('বিশ্লেষণ কর') || 
                          text.includes('ব্যাখ্যা কর') || 
                          text.includes('বিবৃত কর');
      if (isMcqPattern && !isCqPattern) return 'mcq';
      if (isCqPattern) return 'creative';
      return 'mcq'; // Default to mcq if 4 options are present
    }
    if (hasK && hasKh) return 'creative';
    return 'short';
  };

  if (matches.length <= 1) {
    const paragraphs = clean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length <= 1) {
      const p = clean.trim();
      return [{
        type: determineType(p),
        content: cleanQuestionNumbering(p)
      }];
    }
    return paragraphs.map(p => ({
      type: determineType(p),
      content: cleanQuestionNumbering(p)
    }));
  }

  const items: { type: 'creative' | 'short' | 'mcq'; content: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].length;
    const end = (i + 1 < matches.length) ? matches[i + 1].index : clean.length;
    const chunk = clean.substring(start, end).trim();
    if (chunk) {
      items.push({
        type: determineType(chunk),
        content: cleanQuestionNumbering(chunk)
      });
    }
  }

  return items;
}

export function formatMultilineText(text: string): string {
  if (!text) return '';
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs.map(p => {
    const lines = p.split('\n').map(l => formatMath(l.trim())).filter(Boolean);
    return lines.join('<br/>');
  }).join('</p><p style="margin: 6px 0; line-height: 1.6; text-align: justify; display: block;">');
}

export function formatQuestionToBoardStandardHtml(rawText: string, idx: number, isEnglish: boolean, type?: string): string {
  const clean = cleanQuestionNumbering(stripAnswers(rawText));
  const qNum = isEnglish ? `${idx + 1}.` : `${toBengaliNumber(idx + 1)}।`;

  const hasK = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?ক[.)\]]|\(ক\))/i.test(clean);
  const hasKh = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?খ[.)\]]|\(খ\))/i.test(clean);
  const hasG = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?গ[.)\]]|\(গ\))/i.test(clean);
  const hasGh = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?ঘ[.)\]]|\(ঘ\))/i.test(clean);

  // English MCQ options check
  const hasEngA = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?a[.)\]]|\(a\))/i.test(clean);
  const hasEngB = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?b[.)\]]|\(b\))/i.test(clean);
  const hasEngC = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?c[.)\]]|\(c\))/i.test(clean);
  const hasEngD = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?d[.)\]]|\(d\))/i.test(clean);

  // CQ detection: Check explicit type or CQ action verbs
  const hasCqVerbs = clean.includes('উদ্দীপক') || 
                     clean.includes('প্রমাণ কর') || 
                     clean.includes('বিশ্লেষণ কর') || 
                     clean.includes('ব্যাখ্যা কর') || 
                     clean.includes('বিবৃত কর') ||
                     clean.includes('নির্ণয় কর') ||
                     clean.includes('নির্ণয় কর') ||
                     clean.includes('দেখাও যে') ||
                     clean.includes('প্রকাশ কর') ||
                     clean.includes('চিহ্নিত কর');

  const isExplicitMcq = type === 'mcq';
  const isExplicitCq = type === 'creative';
  
  const looksLikeBengaliMcq = !isExplicitCq && hasK && hasKh && (
    isExplicitMcq || 
    ((clean.includes('নিচের কোনটি') || clean.includes('কোনটি?') || clean.includes('কত?')) && !hasCqVerbs)
  );

  const looksLikeEnglishMcq = isEnglish && (isExplicitMcq || (hasEngA && hasEngB && hasEngC && hasEngD));

  // In Bangladesh NCTB, CQ with ক, খ, গ, ঘ is strictly for Bengali medium subjects (Bangla, Math, Science, Religion, BGS).
  // English 1st and English 2nd NEVER have ক, খ, গ, ঘ!
  const isCq = !isEnglish && (isExplicitCq || (!looksLikeBengaliMcq && hasK && hasKh));

  // 1. MCQ Question Format (Row Grid, ZERO individual marks!)
  if (looksLikeBengaliMcq && !isCq) {
    const firstOptMatch = clean.search(/(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?ক[.)\]]|\(ক\))/i);
    const qLine = firstOptMatch !== -1 ? clean.substring(0, firstOptMatch).trim() : clean;
    const optionsPart = firstOptMatch !== -1 ? clean.substring(firstOptMatch) : '';

    const extractOpt = (letter: string, nextLetter?: string) => {
      const reg = new RegExp(`(?:^|[\\n\\r\\s>]|<br\\s*\\/?>|<p[^>]*>)(?:\\(?${letter}[.)\\]]|\\(${letter}\\))\\s*([\\s\\S]*?)(?=(?:^|[\\n\\r\\s>]|<br\\s*\\/?>|<p[^>]*>)(?:\\(?${nextLetter || '$'}[.)\\]]|\\(${nextLetter || '$'}\\))|$)`, 'i');
      const m = optionsPart.match(reg);
      if (!m) return '';
      return m[1].replace(/\[\s*[১-৪1-4]\s*\]\s*$/, '').trim();
    };

    const optA = extractOpt('ক', 'খ');
    const optB = extractOpt('খ', 'গ');
    const optC = extractOpt('গ', 'ঘ');
    const optD = extractOpt('ঘ', undefined);

    const maxLen = Math.max(optA.length, optB.length, optC.length, optD.length);
    const gridCols = maxLen <= 28 ? 4 : maxLen <= 60 ? 2 : 1;

    return `<div class="mcq-item my-2.5 font-kalpurush" style="margin: 8px 0 12px 0; page-break-inside: avoid; display: block;">
  <p class="mcq-question" style="margin: 0 0 5px 0; font-weight: bold; line-height: 1.55; text-align: justify; display: block;">
    <strong class="q-num" style="display: inline; font-weight: bold; margin-right: 6px;">${qNum}</strong>${formatMultilineText(qLine)}
  </p>
  ${(optA || optB || optC || optD) ? `
  <div class="mcq-options-row" style="padding-left: 20px; display: grid; grid-template-columns: repeat(${gridCols}, 1fr); gap: 6px 16px; font-size: 0.98em; line-height: 1.5;">
    <div><strong>(ক)</strong> ${formatMath(optA)}</div>
    <div><strong>(খ)</strong> ${formatMath(optB)}</div>
    <div><strong>(গ)</strong> ${formatMath(optC)}</div>
    <div><strong>(ঘ)</strong> ${formatMath(optD)}</div>
  </div>` : ''}
</div>`;
  }

  // 1b. English MCQ Question Format
  if (looksLikeEnglishMcq && !isCq) {
    const firstOptMatch = clean.search(/(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?a[.)\]]|\(a\))/i);
    const qLine = firstOptMatch !== -1 ? clean.substring(0, firstOptMatch).trim() : clean;
    const optionsPart = firstOptMatch !== -1 ? clean.substring(firstOptMatch) : '';

    const extractOpt = (letter: string, nextLetter?: string) => {
      const reg = new RegExp(`(?:^|[\\n\\r\\s>]|<br\\s*\\/?>|<p[^>]*>)(?:\\(?${letter}[.)\\]]|\\(${letter}\\))\\s*([\\s\\S]*?)(?=(?:^|[\\n\\r\\s>]|<br\\s*\\/?>|<p[^>]*>)(?:\\(?${nextLetter || '$'}[.)\\]]|\\(${nextLetter || '$'}\\))|$)`, 'i');
      const m = optionsPart.match(reg);
      if (!m) return '';
      return m[1].replace(/\[\s*[০-৯0-9\s.xX=+\-]+\s*\]\s*$/, '').trim();
    };

    const optA = extractOpt('a', 'b');
    const optB = extractOpt('b', 'c');
    const optC = extractOpt('c', 'd');
    const optD = extractOpt('d', undefined);

    const maxLen = Math.max(optA.length, optB.length, optC.length, optD.length);
    const gridCols = maxLen <= 28 ? 4 : maxLen <= 60 ? 2 : 1;

    return `<div class="mcq-item my-2.5 font-kalpurush" style="margin: 8px 0 12px 0; page-break-inside: avoid; display: block;">
  <p class="mcq-question" style="margin: 0 0 5px 0; font-weight: bold; line-height: 1.55; text-align: justify; display: block;">
    <strong class="q-num" style="display: inline; font-weight: bold; margin-right: 6px;">${qNum}</strong>${formatMultilineText(qLine)}
  </p>
  ${(optA || optB || optC || optD) ? `
  <div class="mcq-options-row" style="padding-left: 20px; display: grid; grid-template-columns: repeat(${gridCols}, 1fr); gap: 6px 16px; font-size: 0.98em; line-height: 1.5;">
    <div><strong>(a)</strong> ${formatMath(optA)}</div>
    <div><strong>(b)</strong> ${formatMath(optB)}</div>
    <div><strong>(c)</strong> ${formatMath(optC)}</div>
    <div><strong>(d)</strong> ${formatMath(optD)}</div>
  </div>` : ''}
</div>`;
  }

  // 2. Creative Question (CQ): Stimulus + ক, খ, গ, (ঘ) with Marks ১, ২, ৩, ৪ or ২, ৪, ৪
  if (isCq) {
    const regK = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)\s*(?=\(?ক[.)\]]|\(ক\))/i;
    const matchK = clean.search(regK);
    const stimulus = matchK !== -1 ? clean.substring(0, matchK).trim() : clean;
    const subPart = matchK !== -1 ? clean.substring(matchK) : '';

    const extractPart = (currentM: string, nextM?: string, defaultMark: string = '১') => {
      const effectiveNextM = (nextM === 'ঘ' && !hasGh) ? undefined :
                             (nextM === 'গ' && !hasG) ? undefined : nextM;
      const nextPattern = effectiveNextM
        ? `(?:^|[\\n\\r\\s>]|<br\\s*\\/?>|<p[^>]*>)\\s*(?:\\(?${effectiveNextM}[.)\\]]|\\(${effectiveNextM}\\))`
        : '$';
      const reg = new RegExp(
        `(?:^|[\\n\\r\\s>]|<br\\s*\\/?>|<p[^>]*>)\\s*(?:\\(?${currentM}[.)\\]]|\\(${currentM}\\))\\s*([\\s\\S]*?)(?=${nextPattern})`,
        'i'
      );
      const m = subPart.match(reg);
      if (!m) return null;
      let text = m[1].replace(/<\/?p[^>]*>/gi, '').trim();
      let mark = defaultMark;
      const markMatch = text.match(/\[\s*([০-৯0-9\s.xX=+\-]+)\s*\]\s*$/);
      if (markMatch) {
        mark = markMatch[1];
        text = text.replace(/\[\s*([০-৯0-9\s.xX=+\-]+)\s*\]\s*$/, '').trim();
      }
      return { text, mark };
    };

    // ✅ NCTB Board Standard Marks:
    // গণিত সৃজনশীল (৩টি উপ-প্রশ্ন ক, খ, গ): মান বণ্টন ক [২], খ [৪], গ [৪] = মোট ১০ নম্বর
    // বিজ্ঞান/বাংলা সৃজনশীল (৪টি উপ-প্রশ্ন ক, খ, গ, ঘ): মান বণ্টন ক [১], খ [২], গ [৩], ঘ [৪] = মোট ১০ নম্বর
    const isThreePartsCq = !hasGh;
    const defaultMarkA = isThreePartsCq ? '২' : '১';
    const defaultMarkB = isThreePartsCq ? '৪' : '২';
    const defaultMarkC = isThreePartsCq ? '৪' : '৩';
    const defaultMarkD = '৪';

    const partA = extractPart('ক', 'খ', defaultMarkA);
    const partB = extractPart('খ', 'গ', defaultMarkB);
    const partC = extractPart('গ', hasGh ? 'ঘ' : undefined, defaultMarkC);
    const partD = hasGh ? extractPart('ঘ', undefined, defaultMarkD) : null;

    return `<div class="cq-item my-3 font-kalpurush" style="margin: 10px 0 14px 0; page-break-inside: avoid; display: block;">
  <p class="cq-stimulus" style="margin: 0 0 5px 0; line-height: 1.6; text-align: justify; display: block;">
    <strong class="q-num" style="display: inline; font-weight: bold; margin-right: 6px;">${qNum}</strong>${formatMultilineText(stimulus)}
  </p>
  <div class="cq-sub-questions" style="padding-left: 20px; display: block;">
    ${partA ? `<p class="cq-sub" style="margin: 0 0 4px 0; line-height: 1.5; text-align: justify; display: block;">
      <span class="cq-mark" style="float: right; font-weight: bold; margin-left: 12px;">${partA.mark}</span>
      <strong>ক.</strong> ${formatMultilineText(partA.text)}
    </p>` : ''}
    ${partB ? `<p class="cq-sub" style="margin: 0 0 4px 0; line-height: 1.5; text-align: justify; display: block;">
      <span class="cq-mark" style="float: right; font-weight: bold; margin-left: 12px;">${partB.mark}</span>
      <strong>খ.</strong> ${formatMultilineText(partB.text)}
    </p>` : ''}
    ${partC ? `<p class="cq-sub" style="margin: 0 0 4px 0; line-height: 1.5; text-align: justify; display: block;">
      <span class="cq-mark" style="float: right; font-weight: bold; margin-left: 12px;">${partC.mark}</span>
      <strong>গ.</strong> ${formatMultilineText(partC.text)}
    </p>` : ''}
    ${partD ? `<p class="cq-sub" style="margin: 0 0 4px 0; line-height: 1.5; text-align: justify; display: block;">
      <span class="cq-mark" style="float: right; font-weight: bold; margin-left: 12px;">${partD.mark}</span>
      <strong>ঘ.</strong> ${formatMultilineText(partD.text)}
    </p>` : ''}
  </div>
</div>`;
  }

  // 3. Short / English Reading Test / Grammar / Other Question with mark
  let mark = '';
  let bodyText = clean;
  const markMatch = clean.match(/\[\s*([০-৯0-9\s.xX=+\-]+)\s*\]\s*$/);
  if (markMatch) {
    mark = markMatch[1];
    bodyText = clean.replace(/\[\s*([০-৯0-9\s.xX=+\-]+)\s*\]\s*$/, '').trim();
  }

  return `<div class="short-item my-2 font-kalpurush" style="margin: 10px 0 14px 0; page-break-inside: avoid; display: block;">
  <p style="margin: 0; line-height: 1.6; text-align: justify; display: block;">
    ${mark ? `<span class="short-mark" style="float: right; font-weight: bold; margin-left: 12px;">${mark}</span>` : ''}
    <strong class="q-num" style="display: inline; font-weight: bold; margin-right: 6px;">${qNum}</strong>${formatMultilineText(bodyText)}
  </p>
</div>`;
}

export function ensureQuestionIntegrity(container: HTMLElement, isEnglish = false, startIndex = 0) {
  if (!container || typeof window === 'undefined') return;

  // ✅ আলাদা ক্রমিক: CQ, Short, MCQ প্রতিটির counter আলাদা ১ থেকে শুরু
  // 1. Process structured CQ items
  const cqItems = Array.from(container.querySelectorAll('.cq-item'));
  if (cqItems.length > 0) {
    cqItems.forEach((cq, qIdx) => {
      const qNumStr = isEnglish ? `${qIdx + 1}.` : `${toBengaliNumber(qIdx + 1)}।`;
      const stimulus = cq.querySelector('.cq-stimulus') || cq.firstElementChild;
      if (stimulus) {
        (stimulus as HTMLElement).style.textIndent = '';
        (stimulus as HTMLElement).style.paddingLeft = '';
        let numEl = stimulus.querySelector('strong.q-num, strong[contenteditable="false"]');
        if (!numEl) {
          const firstStrong = stimulus.querySelector('strong');
          if (firstStrong && /^[০-৯\d]+[।.)]/.test(firstStrong.textContent?.trim() || '')) {
            firstStrong.removeAttribute('contenteditable');
            firstStrong.classList.add('q-num');
            firstStrong.textContent = qNumStr;
            (firstStrong as HTMLElement).style.display = 'inline';
            (firstStrong as HTMLElement).style.marginRight = '6px';
            (firstStrong as HTMLElement).style.userSelect = 'text';
          } else {
            // Strip plain text number from start of stimulus
            stimulus.innerHTML = stimulus.innerHTML.replace(/^[০-৯\d]+\s*[।.)]\s*/, '');
            const strong = document.createElement('strong');
            strong.removeAttribute('contenteditable');
            strong.className = 'q-num';
            strong.style.display = 'inline';
            strong.style.marginRight = '6px';
            strong.style.userSelect = 'text';
            strong.textContent = qNumStr;
            stimulus.insertBefore(strong, stimulus.firstChild);
          }
        } else {
          numEl.textContent = qNumStr;
          numEl.classList.add('q-num');
          numEl.removeAttribute('contenteditable');
          (numEl as HTMLElement).style.display = 'inline';
          (numEl as HTMLElement).style.marginRight = '6px';
          (numEl as HTMLElement).style.userSelect = 'text';
        }
      }

      // Check sub-questions ক, খ, গ, ঘ
      const subParas = Array.from(cq.querySelectorAll('.cq-sub'));
      const isThreePartsCq = subParas.length === 3;
      const marks = isEnglish 
        ? (isThreePartsCq ? ['2', '4', '4'] : ['1', '2', '3', '4'])
        : (isThreePartsCq ? ['২', '৪', '৪'] : ['১', '২', '৩', '৪']);
      subParas.forEach((sub, sIdx) => {
        let markSpan = sub.querySelector('.cq-mark');
        const expectedMark = marks[sIdx] || '১';
        if (!markSpan) {
          markSpan = document.createElement('span');
          markSpan.className = 'cq-mark';
          (markSpan as HTMLElement).style.cssText = 'float: right; font-weight: bold; margin-left: 12px; user-select: text;';
          markSpan.textContent = expectedMark;
          sub.insertBefore(markSpan, sub.firstChild);
        } else {
          markSpan.removeAttribute('contenteditable');
          if (!markSpan.textContent?.trim()) {
            markSpan.textContent = expectedMark;
          }
          (markSpan as HTMLElement).style.cssText = 'float: right; font-weight: bold; margin-left: 12px; user-select: text;';
        }
      });
    });
  }

  // 2. Process structured Short items (separate counter starting from 1)
  const shortItems = Array.from(container.querySelectorAll('.short-item'));
  if (shortItems.length > 0) {
    shortItems.forEach((si, sIdx) => {
      const qNumStr = isEnglish ? `${sIdx + 1}.` : `${toBengaliNumber(sIdx + 1)}।`;
      const qPara = si.querySelector('p') || si.firstElementChild;
      if (qPara) {
        (qPara as HTMLElement).style.textIndent = '';
        (qPara as HTMLElement).style.paddingLeft = '';
        let numEl = qPara.querySelector('strong.q-num, strong[contenteditable="false"]');
        if (!numEl) {
          const firstStrong = qPara.querySelector('strong');
          if (firstStrong && /^[০-৯\d]+[।.)]/.test(firstStrong.textContent?.trim() || '')) {
            firstStrong.removeAttribute('contenteditable');
            firstStrong.classList.add('q-num');
            firstStrong.textContent = qNumStr;
            (firstStrong as HTMLElement).style.display = 'inline';
            (firstStrong as HTMLElement).style.marginRight = '6px';
            (firstStrong as HTMLElement).style.userSelect = 'text';
          } else {
            qPara.innerHTML = qPara.innerHTML.replace(/^[০-৯\d]+\s*[।.)]\s*/, '');
            const strong = document.createElement('strong');
            strong.removeAttribute('contenteditable');
            strong.className = 'q-num';
            strong.style.display = 'inline';
            strong.style.marginRight = '6px';
            strong.style.userSelect = 'text';
            strong.textContent = qNumStr;
            qPara.insertBefore(strong, qPara.firstChild);
          }
        } else {
          numEl.textContent = qNumStr;
          numEl.classList.add('q-num');
          numEl.removeAttribute('contenteditable');
          (numEl as HTMLElement).style.display = 'inline';
          (numEl as HTMLElement).style.marginRight = '6px';
          (numEl as HTMLElement).style.userSelect = 'text';
        }
      }
    });
  }

  // 3. Process structured MCQ items (separate counter starting from 1)
  const mcqItems = Array.from(container.querySelectorAll('.mcq-item'));
  if (mcqItems.length > 0) {
    mcqItems.forEach((mcq, mIdx) => {
      const qNumStr = isEnglish ? `${mIdx + 1}.` : `${toBengaliNumber(mIdx + 1)}।`;
      const qPara = mcq.querySelector('.mcq-question') || mcq.firstElementChild;
      if (qPara) {
        (qPara as HTMLElement).style.textIndent = '';
        (qPara as HTMLElement).style.paddingLeft = '';
        let numEl = qPara.querySelector('strong.q-num, strong[contenteditable="false"]');
        if (!numEl) {
          const firstStrong = qPara.querySelector('strong');
          if (firstStrong && /^[০-৯\d]+[।.)]/.test(firstStrong.textContent?.trim() || '')) {
            firstStrong.removeAttribute('contenteditable');
            firstStrong.classList.add('q-num');
            firstStrong.textContent = qNumStr;
            (firstStrong as HTMLElement).style.display = 'inline';
            (firstStrong as HTMLElement).style.marginRight = '6px';
            (firstStrong as HTMLElement).style.userSelect = 'text';
          } else {
            qPara.innerHTML = qPara.innerHTML.replace(/^[০-৯\d]+\s*[।.)]\s*/, '');
            const strong = document.createElement('strong');
            strong.removeAttribute('contenteditable');
            strong.className = 'q-num';
            strong.style.display = 'inline';
            strong.style.marginRight = '6px';
            strong.style.userSelect = 'text';
            strong.textContent = qNumStr;
            qPara.insertBefore(strong, qPara.firstChild);
          }
        } else {
          numEl.textContent = qNumStr;
          numEl.classList.add('q-num');
          numEl.removeAttribute('contenteditable');
          (numEl as HTMLElement).style.display = 'inline';
          (numEl as HTMLElement).style.marginRight = '6px';
          (numEl as HTMLElement).style.userSelect = 'text';
        }
      }
    });
  }

  // 4. Fallback: Loose paragraphs if items were unwrapped
  if (cqItems.length === 0 && mcqItems.length === 0 && shortItems.length === 0) {
    const paras = Array.from(container.querySelectorAll('p'));
    let cqCounter = 0;
    let currentSubIdx = 0;
    const marks = isEnglish ? ['1', '2', '3', '4'] : ['১', '২', '৩', '৪'];

    paras.forEach((p, pIdx) => {
      const text = p.textContent?.trim() || '';
      const isSub = /(?:^|\s)(?:(?:\(?\s*[ক-ঘ]\s*[.)\]]|\(\s*[ক-ঘ]\s*\)))/i.test(text) || p.classList.contains('cq-sub');
      const isMultipleMcqInOneLine = text.includes('(ক)') && text.includes('(খ)');

      if (isSub && !isMultipleMcqInOneLine) {
        p.classList.add('cq-sub');
        let markSpan = p.querySelector('.cq-mark');
        const expectedMark = marks[currentSubIdx] || '১';
        if (!markSpan) {
          markSpan = document.createElement('span');
          markSpan.className = 'cq-mark';
          (markSpan as HTMLElement).style.cssText = 'float: right; font-weight: bold; margin-left: 12px; user-select: text;';
          markSpan.textContent = expectedMark;
          p.insertBefore(markSpan, p.firstChild);
        } else {
          markSpan.removeAttribute('contenteditable');
          if (!markSpan.textContent?.trim()) {
            markSpan.textContent = expectedMark;
          }
          (markSpan as HTMLElement).style.cssText = 'float: right; font-weight: bold; margin-left: 12px; user-select: text;';
        }
        currentSubIdx++;
        if (currentSubIdx >= 4) currentSubIdx = 0;
      } else if (!isMultipleMcqInOneLine && text.length > 5) {
        const nextP = paras[pIdx + 1];
        const nextIsSub = nextP && /(?:^|\s)(?:(?:\(?\s*[ক-ঘ]\s*[.)\]]|\(\s*[ক-ঘ]\s*\)))/i.test(nextP.textContent?.trim() || '');
        if (nextIsSub || p.classList.contains('cq-stimulus') || p.classList.contains('mcq-question')) {
          p.classList.add('cq-stimulus');
          (p as HTMLElement).style.textIndent = '';
          (p as HTMLElement).style.paddingLeft = '';
          currentSubIdx = 0;
          const qNumStr = isEnglish ? `${cqCounter + 1}.` : `${toBengaliNumber(cqCounter + 1)}।`;
          let numEl = p.querySelector('strong.q-num, strong[contenteditable="false"]');
          if (!numEl) {
            const firstStrong = p.querySelector('strong');
            if (firstStrong && /^[০-৯\d]+[।.)]/.test(firstStrong.textContent?.trim() || '')) {
              firstStrong.removeAttribute('contenteditable');
              firstStrong.classList.add('q-num');
              firstStrong.textContent = qNumStr;
              (firstStrong as HTMLElement).style.display = 'inline';
              (firstStrong as HTMLElement).style.marginRight = '6px';
              (firstStrong as HTMLElement).style.userSelect = 'text';
            } else {
              p.innerHTML = p.innerHTML.replace(/^[০-৯\d]+\s*[।.)]\s*/, '');
              const strong = document.createElement('strong');
              strong.removeAttribute('contenteditable');
              strong.className = 'q-num';
              strong.style.display = 'inline';
              strong.style.marginRight = '6px';
              strong.style.userSelect = 'text';
              strong.textContent = qNumStr;
              p.insertBefore(strong, p.firstChild);
            }
          } else {
            numEl.textContent = qNumStr;
            numEl.classList.add('q-num');
            numEl.removeAttribute('contenteditable');
            (numEl as HTMLElement).style.display = 'inline';
            (numEl as HTMLElement).style.marginRight = '6px';
            (numEl as HTMLElement).style.userSelect = 'text';
          }
          cqCounter++;
        }
      }
    });
  }
}
