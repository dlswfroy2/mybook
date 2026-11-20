'use server';

/**
 * @fileOverview AI-powered Optical Mark Recognition (OMR) Evaluation Flow.
 * Evaluates filled OMR answer sheets captured from mobile camera or image upload.
 * Extracts Roll Number, Subject Code, Set Code, and marks for all questions.
 */

import { createAiClient, getAvailableApiKeys, CANDIDATE_MODELS } from '@/ai/genkit';

export interface ScanOmrInput {
  imageUri: string;
  questionCount: number;
  answerKey?: Record<number, string>; // e.g. { 1: 'ক', 2: 'খ', ... }
  negativeMark?: number; // e.g. 0.25 or 0
  markPerQuestion?: number; // default 1
}

export interface ScannedQuestionResult {
  questionNumber: number;
  scannedAnswer: string | null; // 'ক' | 'খ' | 'গ' | 'ঘ' | 'MULTIPLE' | null
  correctAnswer: string | null;
  isCorrect: boolean | null;
  status: 'correct' | 'wrong' | 'unanswered' | 'multiple';
}

export interface ScanOmrOutput {
  studentName: string;
  rollNumber: string;
  subjectCode: string;
  setCode: string;
  totalQuestions: number;
  attemptedCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  multipleCount: number;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  questions: ScannedQuestionResult[];
  rawAiResponse?: string;
}

// Convert English option letter to Bengali option letter
function normalizeOption(val: any): string | null {
  if (!val) return null;
  const s = String(val).trim().toUpperCase();
  if (s === 'MULTIPLE' || s.includes('MULTI')) return 'MULTIPLE';
  if (s === 'A' || s === 'ক' || s === '(ক)' || s === '1') return 'ক';
  if (s === 'B' || s === 'খ' || s === '(খ)' || s === '2') return 'খ';
  if (s === 'C' || s === 'গ' || s === '(গ)' || s === '3') return 'গ';
  if (s === 'D' || s === 'ঘ' || s === '(ঘ)' || s === '4') return 'ঘ';
  return null;
}

export async function scanAndEvaluateOmr(input: ScanOmrInput): Promise<ScanOmrOutput> {
  const {
    imageUri,
    questionCount = 30,
    answerKey = {},
    negativeMark = 0,
    markPerQuestion = 1,
  } = input;

  if (!imageUri) {
    throw new Error('ওএমআর শিটের ছবি পাওয়া যায়নি। অনুগ্রহ করে মোবাইল দিয়ে পরিষ্কার ছবি তুলুন।');
  }

  const promptText = `You are a high-precision Optical Mark Recognition (OMR) Sheet Scanner AI.
Your task is to analyze this photo of an OMR answer sheet (বহুনির্বাচনী মূল্যায়ন ওএমআর শিট) and extract the marked bubbles with high accuracy.

Instructions:
1. Examine the Student Information section:
   - "নাম" (Student Name): Extract if written.
   - "রোল নম্বর" (Roll Number): Look at the 4-digit grid. First check the handwritten digits in the top boxes; also check which bubble (০-৯ or 0-9) is darkened in each column. Return the 4-digit roll number (e.g. "1024" or "১০২৪").
   - "বিষয় কোড" (Subject Code): Look at the 3-digit grid (both top boxes and filled 0-9 bubbles). Return the 3-digit code.
   - "প্রশ্ন সেটের কোড" (Set Code): Check which circle is darkened: 'ক' (A), 'খ' (B), 'গ' (C), or 'ঘ' (D).

2. Examine the MCQ Answer Section for questions 1 to ${questionCount}:
   - For each question from 1 to ${questionCount}:
     - Identify which bubble circle is darkened with pen or pencil: 'ক', 'খ', 'গ', 'ঘ'.
     - If the student filled a bubble, return that letter ('ক', 'খ', 'গ', or 'ঘ').
     - If NO bubble is filled for that question, return null.
     - If the student filled MORE THAN ONE bubble for the same question, return "MULTIPLE".
     - Be accurate in distinguishing between darkened filled bubbles vs empty white bubbles.

Return ONLY a valid JSON object matching this schema:
{
  "studentName": "...",
  "rollNumber": "...",
  "subjectCode": "...",
  "setCode": "ক",
  "answers": {
    "1": "ক",
    "2": "খ",
    "3": null,
    "4": "গ"
  }
}`;

  const availableKeys = getAvailableApiKeys();
  let rawJsonText = '';
  let lastError: any = null;

  for (const key of availableKeys) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const client = createAiClient(key, model);
        const resp = await client.generate({
          model,
          prompt: [
            { text: promptText },
            { media: { url: imageUri } },
          ],
        });

        const text = resp.text?.trim() || '';
        if (text && text.includes('{')) {
          rawJsonText = text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[OMR AI Failover] Model ${model} failed: ${err?.message || err}`);
      }
    }
    if (rawJsonText) break;
  }

  if (!rawJsonText) {
    throw new Error(lastError?.message || 'ওএমআর শিট স্ক্যান ব্যর্থ হয়েছে। অনুগ্রহ করে আলোযুক্ত স্থানে পরিষ্কার ছবি তুলুন।');
  }

  // Parse JSON response safely
  let parsedData: any = {};
  try {
    const jsonMatch = rawJsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedData = JSON.parse(jsonMatch[0]);
    } else {
      parsedData = JSON.parse(rawJsonText);
    }
  } catch (err) {
    console.error('Failed to parse AI JSON:', rawJsonText);
    throw new Error('ওএমআর ডাটা প্রক্রিয়াকরণ সম্ভব হয়নি। অনুগ্রহ করে পুনরায় স্ক্যান করুন।');
  }

  const rawAnswers = parsedData.answers || {};
  const studentName = String(parsedData.studentName || '').trim();
  const rollNumber = String(parsedData.rollNumber || '').trim();
  const subjectCode = String(parsedData.subjectCode || '').trim();
  const setCode = normalizeOption(parsedData.setCode) || 'ক';

  const questions: ScannedQuestionResult[] = [];
  let attemptedCount = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let multipleCount = 0;

  for (let q = 1; q <= questionCount; q++) {
    const rawVal = rawAnswers[String(q)] || rawAnswers[q];
    const scanned = normalizeOption(rawVal);
    const correct = normalizeOption(answerKey[q]);

    let status: 'correct' | 'wrong' | 'unanswered' | 'multiple' = 'unanswered';
    let isCorrect: boolean | null = null;

    if (!scanned) {
      status = 'unanswered';
      unansweredCount++;
      isCorrect = false;
    } else if (scanned === 'MULTIPLE') {
      status = 'multiple';
      multipleCount++;
      attemptedCount++;
      isCorrect = false;
      wrongCount++;
    } else {
      attemptedCount++;
      if (correct) {
        if (scanned === correct) {
          status = 'correct';
          correctCount++;
          isCorrect = true;
        } else {
          status = 'wrong';
          wrongCount++;
          isCorrect = false;
        }
      } else {
        // No answer key provided for comparison
        status = 'correct';
        isCorrect = null;
      }
    }

    questions.push({
      questionNumber: q,
      scannedAnswer: scanned,
      correctAnswer: correct,
      isCorrect,
      status,
    });
  }

  const totalMarks = questionCount * markPerQuestion;
  const rawScore = (correctCount * markPerQuestion) - (wrongCount * negativeMark);
  const obtainedMarks = Math.max(0, Math.round(rawScore * 100) / 100);
  const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;

  return {
    studentName,
    rollNumber,
    subjectCode,
    setCode,
    totalQuestions: questionCount,
    attemptedCount,
    correctCount,
    wrongCount,
    unansweredCount,
    multipleCount,
    totalMarks,
    obtainedMarks,
    percentage,
    questions,
    rawAiResponse: rawJsonText,
  };
}
