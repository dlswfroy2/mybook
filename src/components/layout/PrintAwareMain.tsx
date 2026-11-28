'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PrintAwareMainInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPrintMode = searchParams.get('print') === 'true';
  const isFullScreen = pathname === '/whiteboard' || isPrintMode;

  if (isFullScreen) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <main className="flex-1 pt-16 sm:pt-20 pb-6 container mx-auto px-1 sm:px-4 max-w-7xl">
      {children}
    </main>
  );
}

export function PrintAwareMain({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <main className="flex-1 pt-16 sm:pt-20 pb-6 container mx-auto px-1 sm:px-4 max-w-7xl">
        {children}
      </main>
    }>
      <PrintAwareMainInner>{children}</PrintAwareMainInner>
    </Suspense>
  );
}
