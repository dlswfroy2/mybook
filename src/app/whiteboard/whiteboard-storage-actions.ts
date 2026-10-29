'use server';

import fs from 'fs';
import path from 'path';

export interface SavedBoardItem {
  id: string;
  title: string;
  imageUrl: string;
  thumbUrl: string;
  createdAt: string;
}

const STORAGE_DIR = path.join(process.cwd(), 'public', 'uploads', 'whiteboards');
const METADATA_FILE = path.join(STORAGE_DIR, 'boards_index.json');

function ensureDirExists() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function readIndex(): SavedBoardItem[] {
  ensureDirExists();
  if (!fs.existsSync(METADATA_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(METADATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeIndex(data: SavedBoardItem[]) {
  ensureDirExists();
  fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Save a whiteboard page to the server file system & index
 */
export async function saveWhiteboardToServer(params: {
  title: string;
  image: string; // base64
  thumb: string; // base64
}): Promise<{ success: boolean; item?: SavedBoardItem; error?: string }> {
  try {
    ensureDirExists();
    const id = 'wb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // Save image
    const imageBase64 = params.image.replace(/^data:image\/\w+;base64,/, '');
    const imageFileName = `${id}.png`;
    const imageFilePath = path.join(STORAGE_DIR, imageFileName);
    fs.writeFileSync(imageFilePath, Buffer.from(imageBase64, 'base64'));

    // Save thumb
    const thumbBase64 = params.thumb.replace(/^data:image\/\w+;base64,/, '');
    const thumbFileName = `${id}_thumb.jpg`;
    const thumbFilePath = path.join(STORAGE_DIR, thumbFileName);
    fs.writeFileSync(thumbFilePath, Buffer.from(thumbBase64, 'base64'));

    const newItem: SavedBoardItem = {
      id,
      title: params.title,
      imageUrl: `/uploads/whiteboards/${imageFileName}`,
      thumbUrl: `/uploads/whiteboards/${thumbFileName}`,
      createdAt: new Date().toISOString()
    };

    const index = readIndex();
    index.unshift(newItem);
    writeIndex(index);

    return { success: true, item: newItem };
  } catch (error: any) {
    return { success: false, error: error?.message || 'সার্ভারে সংরক্ষণ ব্যর্থ হয়েছে' };
  }
}

/**
 * Fetch all saved whiteboards from the server
 */
export async function getSavedWhiteboardsFromServer(): Promise<SavedBoardItem[]> {
  return readIndex();
}

/**
 * Delete a whiteboard page from the server
 */
export async function deleteWhiteboardFromServer(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    ensureDirExists();
    const index = readIndex();
    const target = index.find(item => item.id === id);
    if (target) {
      const imgPath = path.join(process.cwd(), 'public', target.imageUrl);
      const thumbPath = path.join(process.cwd(), 'public', target.thumbUrl);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }
    const updated = index.filter(item => item.id !== id);
    writeIndex(updated);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'মুছে ফেলতে ব্যর্থ হয়েছে' };
  }
}
