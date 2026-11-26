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
  answerKeysBySet?: Record<string, Record<number, string>>; // e.g. { 'ক': { 1: 'ক' }, 'খ': { 1: 'খ' } }
  negativeMark?: number; // e.g. 0.25 or 0
  markPerQuestion?: number; // default 1
  classId?: string;
  subject?: string;
  examType?: string;
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
  className?: string;
  subjectCode: string;
  subjectName?: string;
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
    answerKeysBySet = {},
    negativeMark = 0,
    markPerQuestion = 1,
    classId = '',
    subject = '',
    examType = '',
  } = input;

  if (!imageUri) {
    throw new Error('ওএমআর শিটের ছবি পাওয়া যায়নি। অনুগ্রহ করে মোবাইল দিয়ে পরিষ্কার ছবি তুলুন।');
  }

  const promptText = `You are a universal, high-precision Optical Mark Recognition (OMR) Sheet Scanner AI.
Your task is to analyze this photo of ANY OMR answer sheet (বোর্ড বা যেকোনো স্কুলের বহুনির্বাচনী ওএমআর শিট) and extract the marked bubbles and student details with extreme accuracy.
The layout might be single-column, 2-column, 3-column, 4-column or 5-column, portrait or landscape, English or Bengali text.

Expected context:
${classId ? `- Expected Class: ${classId}` : ''}
${subject ? `- Expected Subject: ${subject}` : ''}
${examType ? `- Expected Exam Type: ${examType}` : ''}

Instructions:
1. Student Information:
   - "নাম" (Student Name): Extract if written anywhere (top header, student details box, or handwritten).
   - "রোল নম্বর" (Roll Number): Look at Roll No boxes and bubbles. First check any handwritten digits in the boxes; if present, use them. Also check the vertical columns of circles (0-9 or ০-৯) where a bubble is filled. Return the clean numerical roll number string (e.g. "101", "1024", or "৫২").
   - "শ্রেণি" (Class): Extract if visible (e.g. "নবম", "দশম", "Class 9", "10").
   - "বিষয় / বিষয় কোড" (Subject / Code): Extract subject name or 3-digit subject code if filled or written.
   - "প্রশ্ন সেটের কোড" (Set Code): Check which set circle is filled: 'ক' (A), 'খ' (B), 'গ' (C), or 'ঘ' (D). If unmarked, return 'ক'.

2. MCQ Answer Bubbles for Questions 1 to ${questionCount}:
   - Locate the question rows/columns numbered 1 to ${questionCount}.
   - For each question from 1 to ${questionCount}:
     - Check the 4 (or 5) option bubbles: (ক, খ, গ, ঘ) or (A, B, C, D).
     - If exactly ONE bubble circle is darkened / filled with ink/pencil, return that option as 'ক', 'খ', 'গ', or 'ঘ' (convert A->ক, B->খ, C->গ, D->ঘ).
     - If NO circle is filled for that question, return null.
     - If MORE THAN ONE circle is filled for that same question, return "MULTIPLE".
     - Strictly distinguish darkened/shaded pencil or pen marks from empty white circles or slight stray smudges.

Return ONLY a valid JSON object matching this schema:
{
  "studentName": "শিক্ষার্থীর নাম",
  "rollNumber": "101",
  "className": "দশম",
  "subjectCode": "109",
  "subjectName": "গণিত",
  "setCode": "ক",
  "answers": {
    "1": "ক",
    "2": "খ",
    "3": null,
    "4": "গ"
  }
}`;

  const availableKeys = getAvailableApiKeys();
  const candidateModels = [
    'googleai/gemini-flash-latest',
    'googleai/gemini-flash-lite-latest',
    'googleai/gemini-2.5-flash',
    'googleai/gemini-3.5-flash',
  ];
  let rawJsonText = '';
  let lastError: any = null;

  for (const key of availableKeys) {
    for (const model of candidateModels) {
      try {
        const client = createAiClient(key, model);
        const resp = await client.generate({
          model,
          prompt: [
            { text: promptText },
            { media: { url: imageUri } },
          ],
          config: {
            responseMimeType: 'application/json',
          },
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
  const className = String(parsedData.className || '').trim();
  const subjectName = String(parsedData.subjectName || '').trim();
  const subjectCode = String(parsedData.subjectCode || '').trim();
  const setCode = normalizeOption(parsedData.setCode) || 'ক';

  // Determine effective answer key: check if set-specific key exists, otherwise fallback to default
  const effectiveAnswerKey = (answerKeysBySet && answerKeysBySet[setCode])
    ? answerKeysBySet[setCode]
    : (answerKey || {});

  const questions: ScannedQuestionResult[] = [];
  let attemptedCount = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let multipleCount = 0;

  for (let q = 1; q <= questionCount; q++) {
    const rawVal = rawAnswers[String(q)] || rawAnswers[q];
    const scanned = normalizeOption(rawVal);
    const correct = normalizeOption(effectiveAnswerKey[q]);

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
    className,
    subjectName,
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
