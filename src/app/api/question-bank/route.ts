import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'question-bank.json');

// Helper to ensure data directory and file exist
function getStoredQuestions(): any[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify([]), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading question-bank.json:', err);
    return [];
  }
}

function saveStoredQuestions(questions: any[]): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(questions, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing question-bank.json:', err);
    return false;
  }
}

// GET: Return all questions from central server
export async function GET() {
  const questions = getStoredQuestions();
  return NextResponse.json({
    success: true,
    total: questions.length,
    questions
  });
}

// POST: Save or merge questions to central server
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const existing = getStoredQuestions();
    const mergedMap = new Map<string, any>();

    // 1. Add existing
    for (const q of existing) {
      if (q && q.id) {
        mergedMap.set(q.id, q);
      }
    }

    // 2. Add incoming items
    const incoming: any[] = Array.isArray(body?.questions) 
      ? body.questions 
      : Array.isArray(body?.items) 
        ? body.items 
        : body?.question 
          ? [body.question] 
          : [];

    for (const inQ of incoming) {
      if (inQ && inQ.id && inQ.content) {
        mergedMap.set(inQ.id, inQ);
      }
    }

    const unified = Array.from(mergedMap.values());
    saveStoredQuestions(unified);

    return NextResponse.json({
      success: true,
      total: unified.length,
      questions: unified
    });
  } catch (err: any) {
    console.error('POST /api/question-bank error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save questions' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a question from central server
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Question ID required' }, { status: 400 });
    }

    const existing = getStoredQuestions();
    const filtered = existing.filter(q => q.id !== id);
    saveStoredQuestions(filtered);

    return NextResponse.json({
      success: true,
      total: filtered.length
    });
  } catch (err: any) {
    console.error('DELETE /api/question-bank error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete question' },
      { status: 500 }
    );
  }
}
