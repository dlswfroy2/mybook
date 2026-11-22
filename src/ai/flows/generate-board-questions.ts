'use server';

/**
 * @fileOverview AI flow for generating verified NCTB Board Questions based strictly on Exam, Board, Year & Subject.
 */

import { createAiClient, getAvailableApiKeys, CANDIDATE_MODELS } from '@/ai/genkit';

export interface GenerateBoardQuestionsInput {
  examName: string; // যেমন: এসএসসি, এইচএসসি, দাখিল, জেএসসি বা শ্রেণি
  board: string;    // যেমন: দিনাজপুর বোর্ড, ঢাকা বোর্ড, ইত্যাদি
  year: string;     // যেমন: ২০২৪, ২০২৩, ২০২২, ইত্যাদি
  subject: string;  // যেমন: পদার্থবিজ্ঞান, গণিত, বাংলা ১ম, English 1st, ইত্যাদি
  chapter?: string; // অধ্যায় / টপিক (ঐচ্ছিক)
  type: 'mcq' | 'creative' | 'short' | 'english' | 'all';
}

export interface BoardQuestionItem {
  id: string;
  type: 'creative' | 'short' | 'mcq';
  content: string;
}

export interface GenerateBoardQuestionsOutput {
  formattedText: string;
  questions: BoardQuestionItem[];
  board: string;
  year: string;
  subject: string;
  examName: string;
  answerKey?: string;
}

/**
 * Clean up redundant board labels while preserving KaTeX math
 */
function cleanMathAndLatex(raw: string): string {
  if (!raw) return '';
  return raw
    // Remove repeated board names from individual question lines e.g. [দিনাজপুর বোর্ড-২০২৪]
    .replace(/\[\s*[^\]\n]*(?:বোর্ড|Board)[^\]\n]*\]/gi, '')
    // Clean up any remaining \text{...} wrappers
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .trim();
}

export async function generateBoardQuestions(
  input: GenerateBoardQuestionsInput
): Promise<GenerateBoardQuestionsOutput> {
  const { examName, board, year, subject, chapter, type } = input;

  const typeLabel =
    type === 'mcq'
      ? 'বহুনির্বাচনী প্রশ্ন (MCQ)'
      : type === 'creative'
      ? 'সৃজনশীল প্রশ্ন (CQ)'
      : type === 'english'
      ? 'English Question Paper'
      : 'সংক্ষিপ্ত প্রশ্ন';

  let typeSpecificInstruction = '';
  if (type === 'mcq') {
    typeSpecificInstruction = `
- এটি বহুনির্বাচনী (MCQ) পরীক্ষা। এই বিষয়ের বোর্ড পরীক্ষায় যতগুলো MCQ এসেছিল (সাধারণত বিজ্ঞান/আইসিটি বিষয়ে ২৫টি, অন্যান্য বিষয়ে ৩০টি), তার সম্পূর্ণ সবকটি প্রশ্ন ক্রমানুসারে (১ থেকে ২৫ বা ৩০ পর্যন্ত) প্রদান করুন।
- প্রতিটি প্রশ্নের চারটি অপশন এক লাইনে পাশাপাশি রাখুন: (ক) ... (খ) ... (গ) ... (ঘ) ...
- সবকটি প্রশ্নের শেষে আলাদা করে একবারে 'উত্তরমালা' দিন (যেমন: উত্তরমালা: ১. ক, ২. খ...)।
`;
  } else if (type === 'creative') {
    if (subject.includes('গণিত') || subject.includes('Math')) {
      typeSpecificInstruction = `
- এটি গণিত বিষয়ের সৃজনশীল (CQ) পরীক্ষা। NCTB বোর্ড পরীক্ষার অফিশিয়াল ৪টি বিভাগ অনুযায়ী মোট ১১টি সৃজনশীল প্রশ্ন ক্রমানুসারে দিন:
  * ক-বিভাগ: বীজগণিত (প্রশ্ন ১, ২, ৩ - যেকোনো ২টি প্রশ্নের উত্তর দাও)
  * খ-বিভাগ: জ্যামিতি (প্রশ্ন ৪, ৫, ৬ - যেকোনো ২টি প্রশ্নের উত্তর দাও)
  * গ-বিভাগ: ত্রিকোণমিতি ও পরিমিতি (প্রশ্ন ৭, ৮, ৯ - যেকোনো ২টি প্রশ্নের উত্তর দাও)
  * ঘ-বিভাগ: পরিসংখ্যান (প্রশ্ন ১০, ১১ - যেকোনো ১টি প্রশ্নের উত্তর দাও)
  [প্রতিটি বিভাগ থেকে কমপক্ষে ১টি করে মোট ৭টি প্রশ্নের উত্তর দাও। পূর্ণমান: ৭০, সময়: ২ ঘণ্টা ৩০ মিনিট।]
`;
    } else if (
      subject.includes('পদার্থ') ||
      subject.includes('রসায়ন') ||
      subject.includes('রসায়ন') ||
      subject.includes('জীব') ||
      subject.includes('Physics') ||
      subject.includes('Chemistry') ||
      subject.includes('Biology')
    ) {
      typeSpecificInstruction = `
- এটি বিজ্ঞান বিষয়ের সৃজনশীল (CQ) পরীক্ষা। বোর্ড পরীক্ষায় আসা মোট ৮টি সৃজনশীল প্রশ্ন (প্রশ্ন ১ থেকে ৮ পর্যন্ত) সম্পূর্ণ উদ্দীপক ও ক, খ, গ, ঘ সহ ক্রমানুসারে দিন।
  [যেকোনো ৫টি প্রশ্নের উত্তর দাও। পূর্ণমান: ৫০, সময়: ২ ঘণ্টা ৩৫ মিনিট।]
`;
    } else if (subject.includes('বাংলা ১ম') || subject.includes('Bangla 1st')) {
      typeSpecificInstruction = `
- এটি বাংলা ১ম পত্রের সৃজনশীল (CQ) পরীক্ষা। NCTB বোর্ডের অফিশিয়াল ৪টি বিভাগ অনুযায়ী মোট ১১টি সৃজনশীল প্রশ্ন ক্রমানুসারে দিন:
  * ক-বিভাগ: গদ্য (প্রশ্ন ১, ২, ৩, ৪ - যেকোনো ২টি)
  * খ-বিভাগ: পদ্য (প্রশ্ন ৫, ৬, ৭ - যেকোনো ২টি)
  * গ-বিভাগ: উপন্যাস (প্রশ্ন ৮, ৯ - যেকোনো ১টি)
  * ঘ-বিভাগ: নাটক (প্রশ্ন ১০, ১১ - যেকোনো ১টি)
  [প্রতিটি বিভাগ থেকে কমপক্ষে ১টি করে মোট ৭টি প্রশ্নের উত্তর দাও। পূর্ণমান: ৭০।]
`;
    } else {
      typeSpecificInstruction = `
- এটি সৃজনশীল (CQ) পরীক্ষা। এই বিষয়ের বোর্ড পরীক্ষায় আসা সবকটি সৃজনশীল প্রশ্ন ক্রমানুসারে সম্পূর্ণ উদ্দীপক ও ক, খ, গ, ঘ সহ ক্রমানুসারে প্রদান করুন।
`;
    }
  } else if (type === 'english') {
    typeSpecificInstruction = `
- এটি ইংরেজি বিষয়ের পরীক্ষা। বোর্ড পরীক্ষায় আসা সম্পূর্ণ প্রশ্নপত্রের সকল আইটেম (Part A: Reading Test এবং Part B: Writing Test অথবা Grammar এবং Composition) ক্রমানুসারে প্রদান করুন।
- NCTB-এর পূর্ণাঙ্গ অফিসিয়াল ধারায় প্রস্তুত করুন।
`;
  } else {
    typeSpecificInstruction = `
- এই বিষয়ের বোর্ড পরীক্ষায় আসা সম্পূর্ণ প্রশ্নপত্রের সকল প্রশ্ন ক্রমানুসারে প্রদান করুন।
`;
  }

  const prompt = `
আপনি বাংলাদেশ জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (NCTB) এবং সকল মাধ্যমিক ও উচ্চ মাধ্যমিক শিক্ষা বোর্ডের বিগত বছরের অফিশিয়াল প্রশ্নপত্রের একজন সর্বজনস্বীকৃত এবং নির্ভরযোগ্য আর্কাইভিস্ট (Official Question Bank Archivist)।

আপনার সুনির্দিষ্ট দায়িত্ব:
${board}-এর ${examName ? `${examName} পরীক্ষার ` : ''}${year} সালের ${subject} বিষয়ের হুবহু মূল ও আসল বোর্ড প্রশ্নপত্রটি নিখুঁতভাবে প্রদান করা।

কঠোরতম সত্যতা ও জিরো-অনুমান নির্দেশিকা (Strict Zero-Hallucination Mandate):
১. শতভাগ আসল প্রশ্ন: আপনি শুধুমাত্র এবং নিশ্চিতভাবে ${board}-এর ${year} সালের এই পরীক্ষায় মূল প্রশ্নপত্রে যে উদ্দীপক, উপাত্ত ও প্রশ্নসমূহ এসেছিল, হুবহু তাই প্রদান করবেন। (যেমন: ২০২০ সালের ঢাকা বোর্ডে পদার্থবিজ্ঞানে ঠিক যে প্রশ্নগুলো এসেছিল, অন্য কোনো বোর্ডের নয়—ঠিক সেই আসল প্রশ্নপত্রটিই তুলে ধরতে হবে)।
২. কোনো অনুমান নয়: কোনো মনগড়া, আনুমানিক, বা অন্য কোনো বোর্ড/সালের প্রশ্ন দেওয়া কঠোরভাবে নিষিদ্ধ। যদি কোনো নির্দিষ্ট প্রশ্ন সম্পর্কে আপনার মেমরিতে ১০০% নিশ্চয়তা না থাকে, তবে কাল্পনিক প্রশ্ন বানিয়ে লিখবেন না; কেবল নিশ্চিত আসল প্রশ্নই অন্তর্ভুক্ত করবেন।
৩. হেডারের একক অবস্থান:
   প্রশ্নপত্রের শুরুতে হেডারে কেবল একবার পরীক্ষার পরিচয় লিখুন:
   ${examName ? `${examName} পরীক্ষা ` : ''}${year} • ${board}
   বিষয়: ${subject} (${typeLabel})
   [অফিশিয়াল মূল বোর্ড প্রশ্নপত্র]
৪. প্রশ্নের ভেতরের কোনো লাইনে (উদ্দীপক, ক, খ, গ, ঘ বা অপশনের শেষে) বোর্ডের নাম ও সাল লিখবেন না।
${typeSpecificInstruction}
৫. গাণিতিক ও বৈজ্ঞানিক সমীকরণ এবং প্রতীক রূপরেখা:
   - গাণিতিক রাশি, সমীকরণ, সেট, ভগ্নাংশ ও বর্গমূল স্ট্যান্ডার্ড KaTeX ইনলাইন $...$ ফরম্যাটে লিখুন (যেমন: $p + q = \\sqrt{3}$, $\\frac{9\\sqrt{6}}{4}$, $U = \\{x \\in \\mathbb{N} : x^2 \\le 53\\}$, $\\log_x 400 = 4$)।
   - পদার্থ ও রসায়নের একক ও সংকেত স্বাভাবিক টেক্সটে পরিষ্কার আন্তর্জাতিক সংকেতে লিখুন (যেমন: ৪.২ cm, ১ mm, ১৫০ g, ৭৮০০ kg/m³, ১৬ ms⁻¹, H₂SO₄, CaCO₃ → CaO + CO₂)। ব্যাকস্ল্যাশ যুক্ত '\\text{...}' পরিহার করে সরাসরি পরিষ্কার এককে লিখবেন।
`;

  const availableKeys = getAvailableApiKeys();
  let rawText = '';

  for (const key of availableKeys) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const client = createAiClient(key, model);
        const resp = await client.generate({
          model,
          prompt,
          config: { 
            maxOutputTokens: 8192,
            temperature: 0.1,
          },
        });
        rawText = resp.text?.trim() || '';
        if (rawText) break;
      } catch (err) {}
    }
    if (rawText) break;
  }

  if (!rawText) {
    throw new Error('বোর্ড প্রশ্ন তৈরি করা সম্ভব হয়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।');
  }

  // Clean redundant board labels
  const cleanedText = cleanMathAndLatex(rawText);

  // Parse questions from cleanedText into distinct array of items
  const questions: BoardQuestionItem[] = [];
  let answerKey = '';

  if (type === 'mcq') {
    const parts = cleanedText.split(/(?:উত্তরমালা|সঠিক উত্তরমালা|উত্তরসমূহ|Answer Key)[:\n]/i);
    const questionsBlock = parts[0];
    answerKey = parts.length > 1 ? parts[1].trim() : '';

    const qMatches = questionsBlock.split(/(?=\n\s*[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\)])/);
    for (const qm of qMatches) {
      const trimmed = qm.trim();
      if (trimmed && trimmed.match(/^[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\)]/)) {
        questions.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'mcq',
          content: trimmed,
        });
      }
    }

    if (answerKey) {
      questions.push({
        id: Math.random().toString(36).substring(2, 9),
        type: 'short',
        content: `উত্তরমালা:\n${answerKey}`,
      });
    }
  } else if (type === 'creative') {
    // Split by horizontal lines or question numbered headings
    const blocks = cleanedText.split(/\n\s*---\s*\n/);
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      if (!block) continue;
      const sub = block.split(/(?=\n\s*(?:###\s*)?(?:\*\*)?(?:প্রশ্ন\s*)?[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\*])/);
      for (const s of sub) {
        const trimmed = s.trim();
        if (trimmed && trimmed.match(/(?:^|\n)\s*(?:###\s*)?(?:\*\*)?(?:প্রশ্ন\s*)?[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\*]/)) {
          questions.push({
            id: Math.random().toString(36).substring(2, 9),
            type: 'creative',
            content: trimmed,
          });
        }
      }
    }
  } else {
    // English or short
    const blocks = cleanedText.split(/\n\s*---\s*\n/);
    for (const block of blocks) {
      const trimmed = block.trim();
      if (trimmed) {
        if (trimmed.match(/^(?:###\s*)?(?:\*\*)?(?:Item|Question|Part|[১-৯১২৩৪৫৬৭৮৯০0-9]+)[.\*]/i)) {
          questions.push({
            id: Math.random().toString(36).substring(2, 9),
            type: type === 'short' ? 'short' : 'creative',
            content: trimmed,
          });
        }
      }
    }
  }

  // Fallback: If array is empty, wrap whole text or split by lines
  if (questions.length === 0) {
    const fallbackMatches = cleanedText.split(/(?=\n\s*(?:[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\)]|প্রশ্ন\s*[১-৯১২৩৪৫৬৭৮৯০0-9]+))/);
    for (const fm of fallbackMatches) {
      const trimmed = fm.trim();
      if (trimmed) {
        questions.push({
          id: Math.random().toString(36).substring(2, 9),
          type: type === 'mcq' ? 'mcq' : (type === 'creative' ? 'creative' : 'short'),
          content: trimmed,
        });
      }
    }
  }

  if (questions.length === 0) {
    questions.push({
      id: Math.random().toString(36).substring(2, 9),
      type: type === 'mcq' ? 'mcq' : (type === 'creative' ? 'creative' : 'short'),
      content: cleanedText,
    });
  }

  return {
    formattedText: cleanedText,
    questions,
    board,
    year,
    subject,
    examName,
    answerKey,
  };
}
