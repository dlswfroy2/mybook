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

export function formatQuestionToBoardStandardHtml(rawText: string, idx: number, isEnglish: boolean, type?: string): string {
  const clean = cleanQuestionNumbering(stripAnswers(rawText));
  const qNum = isEnglish ? `${idx + 1}.` : `${toBengaliNumber(idx + 1)}।`;

  const hasK = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?ক[.)\]]|\(ক\))/i.test(clean);
  const hasKh = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?খ[.)\]]|\(খ\))/i.test(clean);
  const hasG = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?গ[.)\]]|\(গ\))/i.test(clean);
  const hasGh = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)(?:\(?ঘ[.)\]]|\(ঘ\))/i.test(clean);

  // Check if explicitly MCQ or has 4 distinct options without CQ action verbs
  const isExplicitMcq = type === 'mcq';
  const isExplicitCq = type === 'creative';
  const looksLikeMcq = hasK && hasKh && hasG && hasGh && !isExplicitCq && (
    isExplicitMcq ||
    clean.includes('(ক)') ||
    clean.includes('নিচের কোনটি') ||
    clean.includes('কোনটি?') ||
    clean.includes('কত?') ||
    clean.includes('মান কত') ||
    (!clean.includes('প্রমাণ কর') && !clean.includes('বিশ্লেষণ কর') && !clean.includes('ব্যাখ্যা কর'))
  );

  // 1. MCQ Question Format (Row Grid, ZERO individual marks!)
  if (isExplicitMcq || looksLikeMcq) {
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
    // 4 columns in 1 row if short options, 2 columns if medium, 1 column if long
    const gridCols = maxLen <= 28 ? 4 : maxLen <= 60 ? 2 : 1;

    return `<div class="mcq-item my-2.5 font-kalpurush" style="margin: 8px 0 12px 0; page-break-inside: avoid; display: block;">
  <p class="mcq-question" style="margin: 0 0 5px 0; font-weight: bold; line-height: 1.55; text-align: justify; padding-left: 24px; text-indent: -24px; display: block;">
    <strong contenteditable="false" style="display: inline-block; width: 24px;">${qNum}</strong>${formatMath(qLine)}
  </p>
  ${(optA || optB || optC || optD) ? `
  <div class="mcq-options-row" style="padding-left: 24px; display: grid; grid-template-columns: repeat(${gridCols}, 1fr); gap: 6px 16px; font-size: 0.98em; line-height: 1.5;">
    <div><strong>(ক)</strong> ${formatMath(optA)}</div>
    <div><strong>(খ)</strong> ${formatMath(optB)}</div>
    <div><strong>(গ)</strong> ${formatMath(optC)}</div>
    <div><strong>(ঘ)</strong> ${formatMath(optD)}</div>
  </div>` : ''}
</div>`;
  }

  // 2. Creative Question (CQ): Stimulus + ক, খ, গ, ঘ with Marks ১, ২, ৩, ৪
  if (isExplicitCq || (hasK && hasKh)) {
    const regK = /(?:^|[\n\r\s>]|<br\s*\/?>|<p[^>]*>)\s*(?=\(?ক[.)\]]|\(ক\))/i;
    const matchK = clean.search(regK);
    const stimulus = matchK !== -1 ? clean.substring(0, matchK).trim() : clean;
    const subPart = matchK !== -1 ? clean.substring(matchK) : '';

    const extractPart = (currentM: string, nextM?: string, defaultMark: string = '১') => {
      const nextPattern = nextM
        ? `(?:^|[\\n\\r\\s>]|<br\\s*\\/?>|<p[^>]*>)\\s*(?:\\(?${nextM}[.)\\]]|\\(${nextM}\\))`
        : '$';
      const reg = new RegExp(
        `(?:^|[\\n\\r\\s>]|<br\\s*\\/?>|<p[^>]*>)\\s*(?:\\(?${currentM}[.)\\]]|\\(${currentM}\\))\\s*([\\s\\S]*?)(?=${nextPattern})`,
        'i'
      );
      const m = subPart.match(reg);
      if (!m) return null;
      let text = m[1].replace(/<\/?p[^>]*>/gi, '').trim();
      let mark = defaultMark;
      const markMatch = text.match(/\[\s*([১-৪1-4])\s*\]\s*$/);
      if (markMatch) {
        mark = markMatch[1];
        text = text.replace(/\[\s*([১-৪1-4])\s*\]\s*$/, '').trim();
      }
      return { text, mark };
    };

    const partA = extractPart('ক', 'খ', '১');
    const partB = extractPart('খ', 'গ', '২');
    const partC = extractPart('গ', 'ঘ', '৩');
    const partD = extractPart('ঘ', undefined, '৪');

    return `<div class="cq-item my-3 font-kalpurush" style="margin: 10px 0 14px 0; page-break-inside: avoid; display: block;">
  <p class="cq-stimulus" style="margin: 0 0 5px 0; line-height: 1.6; text-align: justify; padding-left: 24px; text-indent: -24px; display: block;">
    <strong contenteditable="false" style="display: inline-block; width: 24px;">${qNum}</strong>${formatMath(stimulus)}
  </p>
  <div class="cq-sub-questions" style="padding-left: 24px; display: block;">
    ${partA ? `<p class="cq-sub" style="margin: 0 0 4px 0; line-height: 1.5; text-align: justify; display: block;">
      <span class="cq-mark" contenteditable="false" style="float: right; font-weight: bold; margin-left: 12px; user-select: none;">${partA.mark}</span>
      <strong>ক.</strong> ${formatMath(partA.text)}
    </p>` : ''}
    ${partB ? `<p class="cq-sub" style="margin: 0 0 4px 0; line-height: 1.5; text-align: justify; display: block;">
      <span class="cq-mark" contenteditable="false" style="float: right; font-weight: bold; margin-left: 12px; user-select: none;">${partB.mark}</span>
      <strong>খ.</strong> ${formatMath(partB.text)}
    </p>` : ''}
    ${partC ? `<p class="cq-sub" style="margin: 0 0 4px 0; line-height: 1.5; text-align: justify; display: block;">
      <span class="cq-mark" contenteditable="false" style="float: right; font-weight: bold; margin-left: 12px; user-select: none;">${partC.mark}</span>
      <strong>গ.</strong> ${formatMath(partC.text)}
    </p>` : ''}
    ${partD ? `<p class="cq-sub" style="margin: 0 0 4px 0; line-height: 1.5; text-align: justify; display: block;">
      <span class="cq-mark" contenteditable="false" style="float: right; font-weight: bold; margin-left: 12px; user-select: none;">${partD.mark}</span>
      <strong>ঘ.</strong> ${formatMath(partD.text)}
    </p>` : ''}
  </div>
</div>`;
  }

  // 3. Short / Other Question with mark
  let mark = '';
  let bodyText = clean;
  const markMatch = clean.match(/\[\s*([১-৪1-4])\s*\]\s*$/);
  if (markMatch) {
    mark = markMatch[1];
    bodyText = clean.replace(/\[\s*([১-৪1-4])\s*\]\s*$/, '').trim();
  }

  return `<div class="short-item my-2 font-kalpurush" style="margin: 10px 0 14px 0; page-break-inside: avoid; display: block;">
  <p style="margin: 0; line-height: 1.6; text-align: justify; padding-left: 28px; text-indent: -28px; display: block;">
    ${mark ? `<span class="short-mark" contenteditable="false" style="float: right; font-weight: bold; margin-left: 12px; user-select: none;">${mark}</span>` : ''}
    <strong contenteditable="false" style="display: inline-block; width: 28px;">${qNum}</strong>${formatMath(bodyText)}
  </p>
</div>`;
}
