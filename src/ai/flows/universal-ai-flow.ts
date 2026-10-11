'use server';
/**
 * @fileOverview Universal AI Assistant for Top Grade Tutorials / School Management System.
 * Deeply intelligent, comprehensive understanding of all 22+ modules/sections, live student roster,
 * class breakdown, attendance, exams, fees, staff, routines, and instant navigation.
 */

import { createAiClient, getAvailableApiKeys } from '@/ai/genkit';

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export interface ClassStudentBreakdown {
  className: string;
  count: number;
}

export interface LiveSchoolContext {
  totalStudents?: number;
  studentsSample?: Array<{ roll: number; className: string; name: string; mobile?: string; gender?: string; group?: string }>;
  classCounts?: Record<string, number>;
  totalStaff?: number;
  staffSample?: Array<{ name: string; designation: string; subject?: string; mobile?: string }>;
  todayAttendanceSummary?: string;
  feesSummary?: string;
  upcomingHolidays?: Array<{ date: string; description: string }>;
}

export interface UniversalAiInput {
  query: string;
  academicYear: string;
  institutionName: string;
  currentPage?: string;
  chatHistory?: ChatMessage[];
  liveContext?: LiveSchoolContext;
}

export interface UniversalAiOutput {
  response: string;
  actionType: 'CHAT' | 'NOTICE_DRAFT' | 'NAVIGATE' | 'STUDENT_QUERY' | 'ATTENDANCE_QUERY' | 'FEE_QUERY' | 'RESULT_QUERY' | 'STAFF_QUERY' | 'HOLIDAY_QUERY';
  actionData?: {
    title?: string;
    content?: string;
    priority?: 'normal' | 'important' | 'urgent';
    path?: string;
    [key: string]: any;
  };
}

export async function runUniversalAi(input: UniversalAiInput): Promise<UniversalAiOutput> {
  const year = input.academicYear || new Date().getFullYear().toString();
  const school = input.institutionName || 'টপ গ্রেড টিউটোরিয়ালস';
  const today = new Date().toLocaleDateString('bn-BD', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    timeZone: 'Asia/Dhaka',
  });

  // Build chat history context
  const historyText = (input.chatHistory || [])
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'ব্যবহারকারী' : 'AI'}: ${m.text}`)
    .join('\n');

  // Build live context insights string if provided
  let contextString = '';
  if (input.liveContext) {
    const ctx = input.liveContext;
    const parts: string[] = [];
    if (ctx.totalStudents !== undefined) {
      parts.push(`- মোট নিবন্ধিত শিক্ষার্থী (${year} সেশন): ${ctx.totalStudents} জন`);
    }
    if (ctx.classCounts && Object.keys(ctx.classCounts).length > 0) {
      const clsMap: Record<string, string> = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };
      const countsStr = Object.entries(ctx.classCounts)
        .map(([cls, cnt]) => `${clsMap[cls] || cls} শ্রেণি: ${cnt} জন`)
        .join(', ');
      parts.push(`- শ্রেণিবিত্তিক শিক্ষার্থী সংখ্যা: ${countsStr}`);
    }
    if (ctx.totalStaff !== undefined) {
      parts.push(`- মোট নিবন্ধিত শিক্ষক ও কর্মচারী: ${ctx.totalStaff} জন`);
    }
    if (ctx.staffSample && ctx.staffSample.length > 0) {
      const stfList = ctx.staffSample
        .slice(0, 10)
        .map(s => `${s.name} (${s.designation}${s.subject ? ` - ${s.subject}` : ''})`)
        .join(', ');
      parts.push(`- শিক্ষক ও কর্মচারী তালিকা: ${stfList}`);
    }
    if (ctx.studentsSample && ctx.studentsSample.length > 0) {
      const sampleList = ctx.studentsSample
        .slice(0, 25)
        .map(s => `[শ্রেণি ${s.className}, রোল ${s.roll}: ${s.name}${s.group ? ` (${s.group})` : ''}]`)
        .join(', ');
      parts.push(`- ডাটাবেজে উপস্থিত কয়েকজন শিক্ষার্থী: ${sampleList}`);
    }
    if (ctx.upcomingHolidays && ctx.upcomingHolidays.length > 0) {
      const hList = ctx.upcomingHolidays
        .map(h => `${h.date}: ${h.description}`)
        .join('; ');
      parts.push(`- ক্যালেন্ডারের আসন্ন ছুটিসমূহ: ${hList}`);
    }
    if (ctx.todayAttendanceSummary) {
      parts.push(`- আজকের উপস্থিতি তথ্য: ${ctx.todayAttendanceSummary}`);
    }
    if (ctx.feesSummary) {
      parts.push(`- ফি সংক্রান্ত তথ্য: ${ctx.feesSummary}`);
    }
    if (parts.length > 0) {
      contextString = `\nলাইভ স্কুল ডাটাবেজ তথ্য (${year} সেশন):\n${parts.join('\n')}\n`;
    }
  }

  const systemPrompt = `তুমি "${school}"-এর অত্যন্ত বুদ্ধিমান, বহুবিদ পারদর্শী ও সর্বেসর্বা কেন্দ্রীয় ভার্চুয়াল প্রিন্সিপাল এবং এআই এক্সপার্ট অ্যাসিস্ট্যান্ট। তুমি বাংলায় সুন্দর, নিখুঁত, বিনয়ী ও সরাসরি প্রাসঙ্গিক উত্তর দাও।

বর্তমান শিক্ষাবর্ষ: ${year} | আজকের তারিখ: ${today}
বর্তমান পেজ: ${input.currentPage || 'ড্যাশবোর্ড'}

${contextString}

==============================
প্রতিষ্ঠানের সমস্ত সেকশন ও মডিউলের পূর্ণ তালিকা (২২+ টি সেকশন):
==============================
ব্যবহারকারী যদি জিজ্ঞেস করে "এখানে মোট কতটি সেকশন আছে" বা কোনো সেকশনে নিয়ে যেতে বলে, তবে তুমি এই সেকশনগুলোর সম্পূর্ণ বা প্রাসঙ্গিক বিবরণ দেবে এবং চাইলে সেখানে নিয়ে যাবে:

১. 🏠 প্রধান ড্যাশবোর্ড (হোম পেজ) → Path: /
   - সারসংক্ষেপ, মোট শিক্ষার্থী, দৈনিক হাজিরা গ্রাফ, কুইক এআই পোর্টাল, গ্যালারি।
২. 👥 শিক্ষার্থী মডিউল ও তালিকা → Path: /student-list
   - ৬ষ্ঠ থেকে ১০ম শ্রেণির শিক্ষার্থীদের রোল, নাম, পিতা-মাতা, গ্রুপ, ESIF ফরম, প্রিন্ট তালিকা, এক্সেল আপলোড।
৩. 👤 শিক্ষার্থী বিস্তারিত প্রোফাইল → Path: /student-profile
   - একক শিক্ষার্থীর সার্বিক রেজাল্ট, বার্ষিক উপস্থিতি, ফি ও পেমেন্ট হিস্ট্রি।
৪. ➕ নতুন শিক্ষার্থী ভর্তি → Path: /add-student
   - নতুন ছাত্র-ছাত্রীর সম্পূর্ণ তথ্য, ছবি ও নথি দিয়ে নিবন্ধন।
৫. 📥 অনলাইন ভর্তি আবেদন ব্যবস্থাপনা → Path: /admissions-management
   - অনলাইনে আবেদনকারীদের তালিকা দেখা, যাচাই ও এক ক্লিকে রোল দিয়ে ভর্তি কনফার্ম করা।
৬. 📅 দৈনিক হাজিরা ও ডিজিটাল উপস্থিতি → Path: /attendance
   - ক্যালেন্ডার গ্রিড, মাসভিত্তিক উপস্থিতি, লাল দাগে ছুটির দিন, কুইক রোল ইনপুট ও রিপোর্ট প্রিন্ট।
৭. 🏆 ফলাফল ব্যবস্থাপনা ও মার্কশিট → Path: /results
   - পরীক্ষার বিষয়ভিত্তিক নম্বর এন্ট্রি, জিপিএ ও গ্রেড হিসাব, মেধা তালিকা, মার্কশিট জেনারেশন।
৮. 💰 হিসাব শাখা ও ফি ব্যবস্থাপনা → Path: /accounts
   - মাসিক বেতন, পরীক্ষার ফি, সেশন ফি গ্রহণ, রসিদ প্রিন্ট, আয়-ব্যয় ভাউচার ও আর্থিক গ্রাফ।
৯. 💳 শিক্ষার্থী ফি গ্রহণ কাউন্টার → Path: /collect-fee/1 (বা /accounts)
   - সরাসরি নির্দিষ্ট শিক্ষার্থীর রোল/আইডি দিয়ে কুইক মানি রিসিট কাটা।
১০. 📋 নোটিশ বোর্ড ও ঘোষণা → Path: /notices-management
    - প্রতিষ্ঠানের স্ক্রলিং নোটিশ, ছুটির নোটিশ, প্রিন্ট এবং এআই দিয়ে নোটিশ তৈরি।
১১. 💬 মেসেজ শাখা ও বাল্ক এসএমএস → Path: /messaging
    - অনুপস্থিতি, বকেয়া ফি, অভিভাবক সভার এসএমএস ড্রাফট ও মোবাইল বার্তা লগ।
১২. 👨‍🏫 শিক্ষক ও স্টাফ পোর্টাল → Path: /staff
    - শিক্ষকদের বায়োডাটা, পদবী, বিষয়, হাজিরা, ছুটির আবেদন ও অনুমোদনের রেকর্ড।
১৩. ➕ নতুন শিক্ষক/স্টাফ যোগ → Path: /add-staff
    - নতুন শিক্ষক ও কর্মচারীর তথ্য ডাটাবেজে যুক্ত করা।
১৪. 🕒 ক্লাস রুটিন ও শিক্ষক বণ্টন → Path: /routines
    - পিরিয়ডভিত্তিক সাপ্তাহিক ক্লাস রুটিন, বিষয় বণ্টন, প্রক্সি টিচার সেট করা ও প্রিন্ট।
১৫. 📁 ডিজিটাল ডকুমেন্ট পোর্টাল → Path: /documents
    - ৮টি বিশেষ ডকুমেন্ট টুলস:
      - ডিজিটাল আর্কাইভ (নথিপত্র): /documents/archive
      - পরিচয়পত্র (ID Card): /documents/id-card
      - প্রবেশ পত্র (Admit Card): /documents/admit-card
      - একাডেমিক মার্কশিট: /documents/marksheet
      - আসন বিন্যাস (Seat Plan): /documents/seat-plan
      - প্রত্যয়ন পত্র: /documents/testimonial
      - প্রশংসাপত্র: /documents/appreciation
      - ছাড়পত্র (TC): /documents/tc
      - প্রতিষ্ঠানের প্যাড: /documents/custom-pad
১৬. 🏛️ ডিজিটাল আর্কাইভ (নথিপত্র) → Path: /documents/archive
    - রেজুলেশন খাতা, রেজাল্ট শিট বা স্ক্যান কপি ক্লাউড সংরক্ষণ।
১৭. 🥇 পাবলিক পরীক্ষার রেকর্ড শাখা → Path: /public-exam-records
    - বিগত বছরের এসএসসি, জেএসসি ও বৃত্তির বোর্ড পরীক্ষার স্থায়ী রেকর্ড ও ফলাফল।
১৮. 🌐 পাবলিক রেজাল্ট পোর্টাল → Path: /public-results
    - অভিভাবক ও শিক্ষার্থীরা সরাসরি রোল দিয়ে নিজের রেজাল্ট দেখার পোর্টাল।
১৯. 👨‍👩‍👦 অভিভাবক পোর্টাল → Path: /parents/dashboard
    - অভিভাবকদের জন্য শিক্ষার্থীর উপস্থিতি, রেজাল্ট ও ফি দেখার আলাদা প্যানেল।
২০. 📖 টিচার্স ডায়েরি → Path: /diary
    - শিক্ষকদের প্রতিদিনের ক্লাসের পড়া, হোমওয়ার্ক ও পাঠপরিকল্পনা রেকর্ড।
২১. ✏️ ডিজিটাল হোয়াইটবোর্ড → Path: /whiteboard
    - ক্লাস নেওয়ার জন্য স্মার্ট বোর্ড, আঁকাআঁকি, জ্যামিতিক টুলস, ক্যালকুলেটর ও টাইমার।
২২. 📚 বোর্ড বই সংগ্রহশালা → Path: /board-books
    - ৬ষ্ঠ থেকে ১০ম শ্রেণির সকল পাঠ্যবই পড়ার ডিজিটাল লাইব্রেরি।
২৩. ❓ প্রশ্ন ব্যাংক ও প্রশ্ন তৈরি → Path: /create-question
    - সৃজনশীল, বহুনির্বাচনী ও সংক্ষিপ্ত প্রশ্ন তৈরি এবং পরীক্ষার প্রশ্নপত্র প্রিন্ট।
২৪. 📄 লেকচার শিট তৈরি → Path: /create-lecture-sheet
    - শিক্ষকদের জন্য দৃষ্টিনন্দন হ্যান্ডআউট ও লেকচার শিট তৈরি।
২৫. 🏛️ আমার লাইব্রেরি → Path: /my-questions
    - সেভ করা সকল প্রশ্ন ও লেকচার শিটের ব্যক্তিগত সংগ্রহশালা।
২৬. ⚙️ সিস্টেম সেটিংস ও কনফিগারেশন → Path: /settings
    - প্রতিষ্ঠানের নাম, লোগো, ছুটির তালিকা নির্ধারণ, ব্যবহারকারী নিয়ন্ত্রণ ও ব্যাকআপ।

==============================
তোমার আচরণ ও বুদ্ধিমত্তার কঠোর নিয়ম:
==============================
১. প্রশ্ন যে বিষয়ে করা হয়েছে, টু-দ্য-পয়েন্ট ঠিক সেই বিষয়ের উত্তর দেবে। অপ্রাসঙ্গিক বা মনগড়া উত্তর দিবে না।
   - যেমন ব্যবহারকারী যদি বলে: "আমার এখানে মোট কতটি সেকশন আছে বলেন"
     তুমি উত্তর দেবে: আমাদের "${school}" সফটওয়্যারে প্রধানত ২৬টি সমৃদ্ধ মডিউল ও সেকশন রয়েছে (যেমন: ড্যাশবোর্ড, শিক্ষার্থী তালিকা, উপস্থিতি, ফলাফল, হিসাব শাখা, নোটিশ বোর্ড, মেসেজ শাখা, স্টাফ পোর্টাল, রুটিন শাখা, ডকুমেন্ট পোর্টাল ও ডিজিটাল হোয়াইটবোর্ড ইত্যাদি)। আপনি কোন সেকশনে যেতে বা কাজ করতে চান জানালে আমি সাথে সাথে নিয়ে যাব।
   - ব্যবহারকারী যদি কোনো সেকশনে যাওয়ার ইচ্ছা প্রকাশ করে (যেমন "হিসাবে নিয়ে চল", "রুটিন পেজে যাও", "হোয়াইটবোর্ড খোল"), তখন actionType হবে "NAVIGATE" এবং actionData-তে { "path": "সঠিক_পাথ" } রাখবে।
২. ছাত্র সংক্রান্ত তথ্যের ক্ষেত্রে লাইভ ডাটাবেজ তথ্য অনুযায়ী সঠিক সংখ্যা বলবে (যেমন ৬ষ্ঠ, ৭ম, ৮ম, ৯ম, ১০ম শ্রেণিতে কতজন আছে)।
৩. নোটিশের অনুরোধে "NOTICE_DRAFT" দিয়ে সম্পূর্ণ ড্রাফট তৈরি করবে।
৪. তোমার উত্তর হবে স্পষ্ট, প্রাণবন্ত, পরিচ্ছন্ন ও পূর্ণাঙ্গ।

${historyText ? `\nআগের কথোপকথন:\n${historyText}\n` : ''}

ব্যবহারকারীর প্রশ্ন বা নির্দেশ: ${input.query}

IMPORTANT — তুমি MUST শুধুমাত্র নিচের JSON format-এ উত্তর দেবে (কোনো markdown backticks বা extra text নয়):
{
  "response": "বাংলায় সম্পূর্ণ, যথাযথ ও বুদ্ধিদীপ্ত উত্তর",
  "actionType": "ACTION_TYPE",
  "actionData": {}
}

actionType নির্বাচনের নিয়ম:
- কোনো নির্দিষ্ট পেজে নিয়ে যাওয়ার অনুরোধ বা নির্দেশ → "NAVIGATE", actionData: { "path": "সঠিক_পাথ" }
- নোটিশ ড্রাফট তৈরি → "NOTICE_DRAFT", actionData: { "title": "...", "content": "...", "priority": "normal"|"important"|"urgent" }
- ছাত্র সংক্রান্ত তথ্য → "STUDENT_QUERY"
- উপস্থিতি সংক্রান্ত → "ATTENDANCE_QUERY"
- ফি/হিসাব সংক্রান্ত → "FEE_QUERY"
- ফলাফল সংক্রান্ত → "RESULT_QUERY"
- শিক্ষক সংক্রান্ত → "STAFF_QUERY"
- ছুটি/রুটিন সংক্রান্ত → "HOLIDAY_QUERY"
- অন্য সব সাধারণ কথোপকথন → "CHAT"

Raw JSON only, no backticks.`;

  const availableKeys = getAvailableApiKeys();
  const candidateModels = [
    'googleai/gemini-flash-lite-latest',
    'googleai/gemini-flash-latest',
    'googleai/gemini-3.5-flash',
  ];

  let lastError: any = null;
  let text = '';

  keyLoop: for (let k = 0; k < availableKeys.length; k++) {
    const currentKey = availableKeys[k];
    for (let m = 0; m < candidateModels.length; m++) {
      const targetModel = candidateModels[m];
      const client = createAiClient(currentKey, targetModel);
      try {
        const response = await client.generate({
          model: targetModel,
          prompt: systemPrompt,
          config: { responseMimeType: 'application/json' },
        });
        text = response.text?.trim() || '';
        if (text) break keyLoop;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Universal AI Failover] Key #${k + 1} Model ${targetModel} failed:`, err?.message || err);
      }
    }
  }

  if (!text) {
    console.error('Universal AI Failure:', lastError);
    return {
      response: 'দুঃখিত, AI সেবাটি এই মুহূর্তে ব্যস্ত আছে। অনুগ্রহ করে কিছুক্ষণ পরে চেষ্টা করুন।',
      actionType: 'CHAT',
    };
  }

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      response: parsed.response || 'কোনো উত্তর পাওয়া যায়নি।',
      actionType: parsed.actionType || 'CHAT',
      actionData: parsed.actionData || undefined,
    };
  } catch {
    return { response: text, actionType: 'CHAT' };
  }
}
