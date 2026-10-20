'use server';

/**
 * @fileOverview AI-powered OCR flow using Gemini Vision.
 * Supports images (JPG, PNG, WEBP) and multi-page PDF.
 * Accurately extracts Bengali, English, math formulas, and tables.
 */

import { createAiClient, getAvailableApiKeys } from '@/ai/genkit';

export interface AiOcrInput {
  fileDataUri: string;
  mimeType?: string;
}

export interface AiOcrOutput {
  text: string;
  pageCount?: number;
}

const OCR_PROMPT = `তুমি একজন বিশ্বমানের OCR ও লেআউট বিশেষজ্ঞ AI। তোমার কাজ হলো দেওয়া ছবি বা ডকুমেন্ট থেকে সম্পূর্ণ ও নির্ভুলভাবে সমস্ত টেক্সট উদ্ধার করা।

নির্দেশিকা (কঠোরভাবে মানতে হবে):
১. মূল ডকুমেন্টে যেভাবে টেক্সট সাজানো আছে (শিরোনাম, উপশিরোনাম, অনুচ্ছেদ, তালিকা, ছক) ঠিক সেভাবেই output দাও।
২. বাংলা, ইংরেজি, বা মিশ্র ভাষা — সবকিছু হুবহু লিখবে। কোনো বানান পরিবর্তন বা সংক্ষেপ করবে না।
৩. গাণিতিক সূত্র ও চিহ্ন সঠিকভাবে রাখবে (যেমন: ভগ্নাংশ \\frac{a}{b}, বর্গমূল \\sqrt{x}, ঘাত x^2, নিচে x_1)।
৪. ছক/টেবিল থাকলে pipe (|) দিয়ে সারিবদ্ধ করে লিখবে।
৫. শিরোনাম আলাদা লাইনে **শিরোনাম** আকারে লিখবে।
৬. কোনো মন্তব্য বা ভূমিকা যোগ করবে না — শুধু উদ্ধার করা টেক্সট দেবে।

এখন নিচের ডকুমেন্ট থেকে সম্পূর্ণ টেক্সট উদ্ধার করো:`;

async function ocrSingleDocument(dataUri: string): Promise<string> {
  const availableKeys = getAvailableApiKeys();
  const candidateModels = [
    'googleai/gemini-flash-latest',
    'googleai/gemini-flash-lite-latest',
  ];

  let lastError: any = null;

  for (const key of availableKeys) {
    for (const model of candidateModels) {
      try {
        const client = createAiClient(key, model);
        const resp = await client.generate({
          model,
          prompt: [
            { text: OCR_PROMPT },
            { media: { url: dataUri } },
          ],
        });
        const text = resp.text?.trim();
        if (text && text.length > 3) return text;
      } catch (err: any) {
        lastError = err;
        console.warn(`[OCR Failover] Key ending ...${key.slice(-4)} with ${model} failed: ${err?.message || err}`);
      }
    }
  }

  throw new Error(lastError?.message || 'AI OCR ব্যর্থ হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
}

export async function performAiOcr(input: AiOcrInput): Promise<AiOcrOutput> {
  const { fileDataUri } = input;
  if (!fileDataUri) {
    throw new Error('কোনো ফাইল ডাটা পাওয়া যায়নি।');
  }

  if (fileDataUri.includes('|||')) {
    const pages = fileDataUri.split('|||').filter(Boolean);
    const pageTexts: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      const pageText = await ocrSingleDocument(pages[i]);
      pageTexts.push(`--- পৃষ্ঠা ${i + 1} ---\n${pageText}`);
    }
    return { text: pageTexts.join('\n\n'), pageCount: pages.length };
  }

  const text = await ocrSingleDocument(fileDataUri);
  return { text, pageCount: 1 };
}
