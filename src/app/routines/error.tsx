'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Routines page error caught by boundary:', error);
  }, [error]);

  return (
    <div className="min-h-[500px] flex flex-col items-center justify-center p-6 text-center font-kalpurush">
      <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-8 max-w-xl w-full shadow-lg">
        <h2 className="text-2xl font-black text-red-700 mb-2">রুটিন পেজে একটি ত্রুটি ঘটেছে</h2>
        <p className="text-sm text-slate-700 font-bold mb-4 bg-white p-3 rounded-xl border border-red-100 text-left overflow-auto max-h-40 font-mono">
          {error?.message || 'Unknown error'}
        </p>
        {error?.stack && (
          <pre className="text-[11px] text-slate-600 bg-slate-100 p-3 rounded-xl text-left overflow-auto max-h-48 mb-4">
            {error.stack}
          </pre>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={() => reset()} className="font-bold">
            পুনরায় চেষ্টা করুন
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()} className="font-bold">
            পেজ রিফ্রেশ করুন
          </Button>
        </div>
      </div>
    </div>
  );
}
