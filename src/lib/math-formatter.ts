import katex from 'katex';

/**
 * Universal math, physics, and chemistry formatter that transforms LaTeX,
 * math equations, and scientific symbols into HTML rendered with KaTeX and standard Unicode.
 */
export function formatMathToHtml(text: string): string {
  if (!text) return '';

  // 1. Clean markdown headers and bold
  text = text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^\*])\*([^\*]+?)\*([^\*]|$)/g, '$1<strong>$2</strong>$3');

  // 2. Unbalanced / Escaped bracket fixes
  text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  // 3. Convert $$ ... $$ (display math)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: true, output: 'html' });
    } catch {
      return `$$${math}$$`;
    }
  });

  // 4. Convert $ ... $ (inline math)
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return `$${math}$`;
    }
  });

  // 5. Convert \[ ... \] and \( ... \)
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

  // 6. Standalone \sqrt expressions
  const sqrtChainedRegex = /\\sqrt(?:\[[^\]]+\])?\{[^}]+\}(?:\s*(?:\\cdot|\\times|\+|-|\/|\*|=)\s*\\sqrt(?:\[[^\]]+\])?\{[^}]+\})*/g;
  text = text.replace(sqrtChainedRegex, (math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return math;
    }
  });

  // 7. Standalone \frac{...}{...}
  text = text.replace(/\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, (match, num, den) => {
    try {
      return katex.renderToString(`\\frac{${num}}{${den}}`, { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return `<span class="math-frac"><span class="math-num">${num}</span><span class="math-den">${den}</span></span>`;
    }
  });

  // 8. Standalone \log expressions: \log_x 400
  const logRegex = /\\log(?:_[a-zA-Z0-9]+|_\{[^}]+\})?(?:\s*(?:\([^)]+\)|[a-zA-Z0-9]+))?/g;
  text = text.replace(logRegex, (match) => {
    try {
      return katex.renderToString(match.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return match;
    }
  });

  // 9. Recurring decimals (পৌনঃপুনিক) outside math tags: \dot{5} -> 5̇
  text = text.replace(/\\dot\{([^}]+)\}/g, (_, inner) => {
    return `<span style="display:inline-block;position:relative;text-align:center;padding-top:2px;"><span style="position:absolute;top:-0.45em;left:0;right:0;font-size:1.1em;line-height:1;text-align:center;">•</span>${inner}</span>`;
  });

  // 10. Chemistry & Physics formulas outside math tags
  // Chemical subscript numbers: H_2O, CO_2, H_2SO_4, CaCO_3
  text = text.replace(/([A-Z][a-z]?)_\{?(\d+)\}?/g, '$1<sub>$2</sub>');
  // Chemical and atomic ions: Fe^{2+}, Na^+, Cl^-, SO_4^{2-}
  text = text.replace(/\^\{?([0-9]*[+-])\}?/g, '<sup>$1</sup>');
  // Physics Vectors: \vec{v}, \vec{F}, \vec{a}
  text = text.replace(/\\vec\{([A-Za-z])\}/g, '$1⃗');

  // 11. Physics & Chemistry Arrows & States
  text = text
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
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\tau/g, 'τ')
    .replace(/\\eta/g, 'η');

  // 12. Mathematics, Set Theory & Geometry Symbols
  text = text
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\mathbb\{Q\}/g, 'ℚ')
    .replace(/\\mathbb\{C\}/g, 'ℂ')
    .replace(/\\in(?![a-zA-Z])/g, ' ∈ ')
    .replace(/\\notin/g, ' ∉ ')
    .replace(/\\subset/g, ' ⊂ ')
    .replace(/\\subseteq/g, ' ⊆ ')
    .replace(/\\cup/g, ' ∪ ')
    .replace(/\\cap/g, ' ∩ ')
    .replace(/\\emptyset/g, ' ∅ ')
    .replace(/\\le(?![a-zA-Z])/g, ' ≤ ')
    .replace(/\\ge(?![a-zA-Z])/g, ' ≥ ')
    .replace(/\\neq/g, ' ≠ ')
    .replace(/\\times/g, ' × ')
    .replace(/\\cdot/g, ' · ')
    .replace(/\\div/g, ' ÷ ')
    .replace(/\\pm/g, ' ± ')
    .replace(/\\mp/g, ' ∓ ')
    .replace(/\\approx/g, ' ≈ ')
    .replace(/\\equiv/g, ' ≡ ')
    .replace(/\\propto/g, ' ∝ ')
    .replace(/\\infty/g, ' ∞ ')
    .replace(/\\therefore/g, ' ∴ ')
    .replace(/\\because/g, ' ∵ ')
    .replace(/\\circ/g, '°')
    .replace(/\\degree/g, '°')
    .replace(/\\angle/g, '∠')
    .replace(/\\triangle/g, '△')
    .replace(/\\perp/g, '⊥')
    .replace(/\\parallel/g, '∥')
    .replace(/\\cong/g, '≅')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}');

  // 13. Exponent characters outside math tags: ^2, ^3, ^4
  text = text.replace(/\^\{?(-?\d+)\}?/g, (_, p1) => {
    const superMap: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
      '-': '⁻'
    };
    return p1.split('').map((c: string) => superMap[c] || c).join('');
  });

  return text;
}
