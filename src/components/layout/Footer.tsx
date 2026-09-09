'use client';
/**
 * @fileOverview Dynamic footer component linked to academic session.
 */
import { useAcademicYear } from '@/context/AcademicYearContext';

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export function Footer() {
  const { selectedYear } = useAcademicYear();
  const displayYear = toBengaliNumber(selectedYear);

  return (
    <footer className="py-6 text-center text-[10px] text-muted-foreground border-t bg-muted/5 mb-10 no-print font-bold">
      <p className="tracking-widest uppercase">© {displayYear} টপ গ্রেড টিউটোরিয়ালস।</p>
      <p className="mt-1 text-primary/60">সর্বস্বত্ব সংরক্ষিত।</p>
    </footer>
  );
}
