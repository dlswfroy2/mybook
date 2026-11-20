export type SubjectCategory = 'english_1st' | 'english_2nd' | 'math' | 'bangla_1st' | 'bangla_2nd' | 'science' | 'general';

export function getSubjectCategory(subject: string): SubjectCategory {
  const s = (subject || '').toLowerCase().trim();
  if (s.includes('ইংরেজি প্রথম') || s.includes('english 1') || s.includes('english first') || s.includes('english 1st') || s.includes('english i') || s.includes('eng 1')) {
    return 'english_1st';
  }
  if (s.includes('ইংরেজি দ্বিতীয়') || s.includes('english 2') || s.includes('english second') || s.includes('english 2nd') || s.includes('english ii') || s.includes('eng 2') || s.includes('grammar')) {
    return 'english_2nd';
  }
  if (s.includes('গণিত') || s.includes('math') || s.includes('উচ্চতর গণিত') || s.includes('higher math')) {
    return 'math';
  }
  if (s.includes('বাংলা প্রথম') || s.includes('bangla 1') || s.includes('bangla first')) {
    return 'bangla_1st';
  }
  if (s.includes('বাংলা দ্বিতীয়') || s.includes('bangla 2') || s.includes('bangla second') || s.includes('ব্যাকরণ')) {
    return 'bangla_2nd';
  }
  if (s.includes('পদার্থ') || s.includes('রসায়ন') || s.includes('জীব') || s.includes('বিজ্ঞান') || s.includes('science') || s.includes('physics') || s.includes('chemistry') || s.includes('biology')) {
    return 'science';
  }
  return 'general';
}
