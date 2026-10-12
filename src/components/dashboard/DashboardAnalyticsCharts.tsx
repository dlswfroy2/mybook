'use client';

import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { Student } from '@/lib/student-data';
import { TrendingUp, Users, PieChart as PieIcon, BarChart3 } from 'lucide-react';

interface DashboardAnalyticsChartsProps {
  students: Student[];
  academicYear: string;
}

const CLASS_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const CLASS_LABELS: Record<string, string> = {
  '6': '৬ষ্ঠ শ্রেণি',
  '7': '৭ম শ্রেণি',
  '8': '৮ম শ্রেণি',
  '9': '৯ম শ্রেণি',
  '10': '১০ম শ্রেণি',
};

const BENGALI_NUMBERS: Record<string, string> = {
  '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
  '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
};

const toBn = (num: number | string) => {
  return String(num).replace(/[0-9]/g, (d) => BENGALI_NUMBERS[d] || d);
};

export function DashboardAnalyticsCharts({ students, academicYear }: DashboardAnalyticsChartsProps) {
  // Class breakdown calculation
  const classData = useMemo(() => {
    const counts: Record<string, number> = { '6': 0, '7': 0, '8': 0, '9': 0, '10': 0 };
    students.forEach((s) => {
      const cls = String(s.className || '').trim();
      if (counts[cls] !== undefined) {
        counts[cls]++;
      } else if (cls) {
        counts[cls] = (counts[cls] || 0) + 1;
      }
    });

    return Object.entries(counts).map(([cls, count], idx) => ({
      name: CLASS_LABELS[cls] || `${cls} শ্রেণি`,
      students: count,
      color: CLASS_COLORS[idx % CLASS_COLORS.length],
    }));
  }, [students]);

  // Gender breakdown calculation
  const genderData = useMemo(() => {
    let male = 0;
    let female = 0;
    students.forEach((s) => {
      const g = (s.gender || '').toLowerCase();
      if (g.includes('female') || g.includes('ছাত্রী') || g.includes('মহিলা')) {
        female++;
      } else {
        male++;
      }
    });
    return [
      { name: 'ছাত্র', value: male, color: '#2563eb' },
      { name: 'ছাত্রী', value: female, color: '#ec4899' },
    ];
  }, [students]);

  // Sample projected fee collection distribution per class
  const revenueTrendData = useMemo(() => {
    const months = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
    const baseCount = students.length || 10;
    return months.map((m, idx) => ({
      month: m,
      collected: Math.round((baseCount * 500 * (0.8 + ((idx * 7) % 35) / 100))),
      target: baseCount * 500,
    }));
  }, [students.length]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 my-3 font-kalpurush">
      {/* 1. Class-wise Student Distribution Bar Chart */}
      <Card className="border-2 border-indigo-200/80 shadow-md bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
        <CardHeader className="bg-gradient-to-r from-indigo-50/80 to-blue-50/80 p-3.5 border-b border-indigo-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-black text-indigo-950">শ্রেণিভিত্তিক শিক্ষার্থী সংখ্যা</CardTitle>
              <p className="text-[10px] text-indigo-600 font-bold">{academicYear} শিক্ষাবর্ষ</p>
            </div>
          </div>
          <span className="text-xs font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full">
            মোট: {toBn(students.length)}
          </span>
        </CardHeader>
        <CardContent className="p-3 pt-4">
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                <Tooltip 
                  formatter={(val: any) => [`${toBn(val)} জন`, 'শিক্ষার্থী']}
                  contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey="students" radius={[6, 6, 0, 0]}>
                  {classData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 2. Monthly Fee Collection Trend Bar Chart */}
      <Card className="border-2 border-emerald-200/80 shadow-md bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
        <CardHeader className="bg-gradient-to-r from-emerald-50/80 to-teal-50/80 p-3.5 border-b border-emerald-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-black text-emerald-950">মাসিক ফি আদায় ট্রেন্ড</CardTitle>
              <p className="text-[10px] text-emerald-700 font-bold">আদায় লক্ষ্যমাত্রা বনাম সংগৃহীত</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-4">
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#475569', fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickFormatter={(val) => `৳${toBn(val / 1000)}k`} />
                <Tooltip 
                  formatter={(val: any) => [`৳ ${toBn(val)}`, 'পরিমাণ']}
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey="collected" fill="#059669" radius={[4, 4, 0, 0]} name="সংগৃহীত" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 3. Gender Distribution Pie Chart */}
      <Card className="border-2 border-pink-200/80 shadow-md bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
        <CardHeader className="bg-gradient-to-r from-pink-50/80 to-rose-50/80 p-3.5 border-b border-pink-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-pink-600 text-white rounded-lg shadow-sm">
              <PieIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-black text-pink-950">ছাত্র ও ছাত্রী অনুপাত</CardTitle>
              <p className="text-[10px] text-pink-700 font-bold">লিঙ্গভিত্তিক অনুপাত</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          <div className="h-[200px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: any) => [`${toBn(val)} জন`, '']}
                  contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  formatter={(value, entry: any) => (
                    <span className="text-xs font-bold text-slate-700">
                      {value}: {toBn(entry.payload.value)} জন
                    </span>
                  )} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
