import katex from 'katex';

/**
 * Universal math and science formatter that transforms LaTeX, math equations,
 * and scientific symbols into HTML rendered with KaTeX and standard Unicode.
 */
export function formatMathToHtml(text: string): string {
  if (!text) return '';

  // 1. Convert markdown bold **text** to <strong>text</strong>
  text = text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');

  // 2. Convert $$ ... $$ (display math)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: true, output: 'html' });
    } catch {
      return `$$${math}$$`;
    }
  });

  // 3. Convert $ ... $ (inline math)
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return `$${math}$`;
    }
  });

  // 4. Standalone \sqrt expressions
  const sqrtChainedRegex = /\\sqrt(?:\[[^\]]+\])?\{[^}]+\}(?:\s*(?:\\cdot|\\times|\+|-|\/|\*|=)\s*\\sqrt(?:\[[^\]]+\])?\{[^}]+\})*/g;
  text = text.replace(sqrtChainedRegex, (math) => {
    try {
      return katex.renderToString(math.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return math;
    }
  });

  // 5. Standalone \frac{...}{...}
  text = text.replace(/\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, (match, num, den) => {
    try {
      return katex.renderToString(`\\frac{${num}}{${den}}`, { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return `(${num}/${den})`;
    }
  });

  // 6. Standalone \log expressions: \log_x 400
  const logRegex = /\\log(?:_[a-zA-Z0-9]+|_\{[^}]+\})?(?:\s*(?:\([^)]+\)|[a-zA-Z0-9]+))?/g;
  text = text.replace(logRegex, (match) => {
    try {
      return katex.renderToString(match.trim(), { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      return match;
    }
  });

  // 7. Math & Science Symbols (Sets, Algebra, Physics, Chemistry)
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
    .replace(/\\rightarrow|\\to/g, ' → ')
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
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\omega/g, 'ω')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}');

  // 8. Superscript exponents ^2, ^3, ^4, ^-1, ^-2
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
