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
}

export async function generateBoardQuestions(
  input: GenerateBoardQuestionsInput
): Promise<GenerateBoardQuestionsOutput> {
  const { examName, board, year, subject, chapter, type } = input;

  let targetPrompt = '';

  if (type === 'mcq') {
    targetPrompt = `শুধু ${board}-এর ${subject}${chapter ? ` ও ${chapter}` : ''} থেকে আসা বহুনির্বাচনী (MCQ) প্রশ্নগুলো দাও। অন্য কোনো বোর্ডের প্রশ্ন মিশাবে না। প্রতিটি প্রশ্নের চারটি অপশন এক লাইনে পাশাপাশি রাখো এবং সব প্রশ্নের সঠিক উত্তর শেষে আলাদা করে উত্তরমালায় দাও। কোনো প্রশ্নের বোর্ড সম্পর্কে নিশ্চিত না হলে সেটি বাদ দেবে, অনুমান করে লিখবে না।`;
  } else if (type === 'creative') {
    targetPrompt = `শুধু ${board}-এর ${year ? `${year} সালের ` : ''}${chapter ? `${chapter} অধ্যায়-এর ` : ''}${examName ? `${examName} পরীক্ষার ` : ''}${subject} বিষয়ের সৃজনশীল (ক, খ, গ, ঘ) প্রশ্নগুলো দাও। কোনো অনুমানভিত্তিক বা অন্য বোর্ডের প্রশ্ন যুক্ত করবে না। প্রশ্নের শেষে কোন সালে ও কোন বোর্ডে এসেছে তা উল্লেখ করো (যেমন: [${board}-${year}])। কোনো প্রশ্নের বোর্ড সম্পর্কে নিশ্চিত না হলে সেটি বাদ দেবে, অনুমান করে লিখবে না।`;
  } else if (type === 'short') {
    targetPrompt = `শুধু ${board}-এর ${year ? `${year} সালের ` : ''}${chapter ? `${chapter} অধ্যায়-এর ` : ''}${examName ? `${examName} পরীক্ষার ` : ''}${subject} বিষয়ের সংক্ষিপ্ত প্রশ্নগুলো দাও। কোনো অনুমানভিত্তিক বা অন্য বোর্ডের প্রশ্ন যুক্ত করবে না। প্রশ্নের শেষে কোন সালে ও কোন বোর্ডে এসেছে তা উল্লেখ করো (যেমন: [${board}-${year}])। কোনো প্রশ্নের বোর্ড সম্পর্কে নিশ্চিত না হলে সেটি বাদ দেবে, অনুমান করে লিখবে না।`;
  } else if (type === 'english') {
    targetPrompt = `শুধু ${board}-এর ${examName ? `${examName} পরীক্ষার ` : ''}${subject} বিষয়ের ${year}-এর প্রশ্নগুলো দাও। অন্য কোনো বোর্ডের প্রশ্ন দেবে না। শুধু যে প্রশ্নগুলো নিশ্চিতভাবে এই বোর্ডে এসেছে, সেগুলোই তালিকা আকারে দাও। কোনো প্রশ্নের বোর্ড সম্পর্কে নিশ্চিত না হলে সেটি বাদ দেবে, অনুমান করে লিখবে না।`;
  } else {
    // General / all
    targetPrompt = `শুধু ${board}-এর ${examName ? `${examName} পরীক্ষার ` : ''}${subject} বিষয়ের ${year}-এর প্রশ্নগুলো দাও। অন্য কোনো বোর্ডের প্রশ্ন দেবে না। শুধু যে প্রশ্নগুলো নিশ্চিতভাবে এই বোর্ডে এসেছে, সেগুলোই তালিকা আকারে দাও। কোনো প্রশ্নের বোর্ড সম্পর্কে নিশ্চিত না হলে সেটি বাদ দেবে, অনুমান করে লিখবে না।`;
  }

  const systemInstructions = `
আপনি বাংলাদেশ জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (NCTB) এবং সকল শিক্ষা বোর্ডের প্রশ্ন বিশ্লেষক ও শিক্ষক বিশেষজ্ঞ।
আপনাকে দেওয়া ব্যবহারকারীর সুনির্দিষ্ট শর্তাবলী ১০০% মানতে হবে:

ব্যবহারকারীর নির্দিষ্ট প্রম্পট:
"${targetPrompt}"

কঠোর শর্তাবলী ও রূপরেখা:
১. শুধুমাত্র ${board}-এর ${year} সালের নিশ্চিত প্রশ্ন অন্তর্ভুক্ত করবেন। অন্য কোনো বোর্ডের প্রশ্ন কিছুতেই মেশাবেন না।
২. নিশ্চিত না হলে অনুমান করতে মানা: কোনো প্রশ্নের বোর্ড বা সাল সম্পর্কে নিশ্চিত না হলে সেটি বাদ দেবে, অনুমান করে লিখবে না।
৩. বহুনির্বাচনী (MCQ) হলে:
   - প্রতিটি প্রশ্নের চারটি অপশন এক লাইনে পাশাপাশি সাজাবেন: (ক) ... (খ) ... (গ) ... (ঘ) ...
   - সব প্রশ্নের সঠিক উত্তর শেষে আলাদা করে 'উত্তরমালা' অংশে একবারে দেবেন।
৪. সৃজনশীল (CQ) হলে:
   - উদ্দীপক এরপর ক, খ, গ, ঘ আকারে থাকবে।
   - প্রতিটি প্রশ্নের শেষে [${board}-${year}] উল্লেখ থাকবে।
৫. ইংরেজি বিষয়ের জন্য:
   - NCTB অফিসিয়াল ইংরেজি পরীক্ষার প্রশ্নপত্রের ধারায় ইংরেজিতে প্রশ্ন উপস্থাপন করবেন।
   - শেষে বোর্ড ও সাল নির্দেশ থাকবে।

সরাসরি প্রস্তুতকৃত প্রশ্নমালা এবং শেষে প্রয়োজনীয় ক্ষেত্রে উত্তরমালা লিখুন। কোনো অপ্রয়োজনীয় ভূমিকা বা অতিরিক্ত কথা লিখবেন না।
`;

  const availableKeys = getAvailableApiKeys();
  let rawText = '';

  for (const key of availableKeys) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const client = createAiClient(key, model);
        const resp = await client.generate({
          model,
          prompt: `${systemInstructions}\n\n${targetPrompt}`,
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

  // Parse questions from rawText to array of items
  const questions: BoardQuestionItem[] = [];
  
  if (type === 'mcq') {
    // Split into questions and answer key
    const parts = rawText.split(/(?:উত্তরমালা|সঠিক উত্তরমালা|উত্তরসমূহ|Answer Key)[:\n]/i);
    const questionsBlock = parts[0];
    const answerKey = parts.length > 1 ? parts[1].trim() : '';

    // Split by question numbers (e.g. ১., ২. or 1., 2.)
    const qMatches = questionsBlock.split(/(?=\n[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\)])/);
    for (const qm of qMatches) {
      const trimmed = qm.trim();
      if (trimmed) {
        questions.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'mcq',
          content: trimmed,
        });
      }
    }

    if (answerKey && questions.length > 0) {
      questions.push({
        id: Math.random().toString(36).substring(2, 9),
        type: 'short',
        content: `উত্তরমালা:\n${answerKey}`,
      });
    }
  } else if (type === 'creative') {
    const qMatches = rawText.split(/(?=\n[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\)]\s*(?:উদ্দীপক|নিচের|পড়ে))/);
    if (qMatches.length > 1) {
      for (const qm of qMatches) {
        const trimmed = qm.trim();
        if (trimmed) {
          questions.push({
            id: Math.random().toString(36).substring(2, 9),
            type: 'creative',
            content: trimmed,
          });
        }
      }
    } else {
      questions.push({
        id: Math.random().toString(36).substring(2, 9),
        type: 'creative',
        content: rawText,
      });
    }
  } else {
    // General or short
    const qMatches = rawText.split(/(?=\n[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\)])/);
    if (qMatches.length > 1) {
      for (const qm of qMatches) {
        const trimmed = qm.trim();
        if (trimmed) {
          questions.push({
            id: Math.random().toString(36).substring(2, 9),
            type: type === 'short' ? 'short' : 'creative',
            content: trimmed,
          });
        }
      }
    } else {
      questions.push({
        id: Math.random().toString(36).substring(2, 9),
        type: 'short',
        content: rawText,
      });
    }
  }

  // If questions empty, wrap full text
  if (questions.length === 0) {
    questions.push({
      id: Math.random().toString(36).substring(2, 9),
      type: type === 'mcq' ? 'mcq' : (type === 'creative' ? 'creative' : 'short'),
      content: rawText,
    });
  }

  return {
    formattedText: rawText,
    questions,
    board,
    year,
    subject,
    examName,
  };
}
