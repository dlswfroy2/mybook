import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function TopTableScrollbar({
    targetRef,
    minScrollWidth = 1100
}: {
    targetRef: React.RefObject<HTMLDivElement | null>;
    minScrollWidth?: number;
}) {
    const topScrollRef = useRef<HTMLDivElement>(null);
    const [scrollWidth, setScrollWidth] = useState(minScrollWidth);
    const activeScroller = useRef<'top' | 'table' | null>(null);
    const scrollEndTimer = useRef<NodeJS.Timeout | null>(null);

    const updateWidth = useCallback(() => {
        if (activeScroller.current) return;
        const table = targetRef.current;
        if (table) {
            const sw = table.scrollWidth;
            if (sw > 0) {
                setScrollWidth(prev => {
                    if (Math.abs(prev - sw) > 5) {
                        return Math.max(sw, minScrollWidth);
                    }
                    return prev;
                });
            }
        }
    }, [targetRef, minScrollWidth]);

    const handleScrollSync = useCallback((source: 'top' | 'table') => {
        if (activeScroller.current && activeScroller.current !== source) return;
        activeScroller.current = source;

        if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
        scrollEndTimer.current = setTimeout(() => {
            activeScroller.current = null;
        }, 80);

        const top = topScrollRef.current;
        const table = targetRef.current;
        if (!top || !table) return;

        if (source === 'top') {
            if (Math.abs(table.scrollLeft - top.scrollLeft) >= 1) {
                table.scrollLeft = top.scrollLeft;
            }
        } else {
            if (Math.abs(top.scrollLeft - table.scrollLeft) >= 1) {
                top.scrollLeft = table.scrollLeft;
            }
        }
    }, [targetRef]);

    useEffect(() => {
        let cleanup: (() => void) | null = null;
        let attachedEl: HTMLElement | null = null;

        const attachListener = () => {
            const table = targetRef.current;
            if (table && table !== attachedEl) {
                if (cleanup) cleanup();
                attachedEl = table;
                const onTableScroll = () => handleScrollSync('table');
                table.addEventListener('scroll', onTableScroll, { passive: true });
                cleanup = () => {
                    table.removeEventListener('scroll', onTableScroll);
                    attachedEl = null;
                };
                updateWidth();
                return true;
            }
            return false;
        };

        attachListener();
        const pollInterval = setInterval(() => {
            if (!attachedEl && targetRef.current) {
                attachListener();
            }
        }, 300);

        return () => {
            clearInterval(pollInterval);
            if (cleanup) cleanup();
        };
    }, [targetRef, handleScrollSync, updateWidth]);

    useEffect(() => {
        updateWidth();
        const t1 = setTimeout(updateWidth, 100);
        const t2 = setTimeout(updateWidth, 500);

        let ro: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(() => updateWidth());
            if (targetRef.current) {
                ro.observe(targetRef.current);
                const tbl = targetRef.current.querySelector('table');
                if (tbl) ro.observe(tbl);
            }
        }

        window.addEventListener('resize', updateWidth);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            if (ro) ro.disconnect();
            window.removeEventListener('resize', updateWidth);
        };
    }, [targetRef, updateWidth]);

    return (
        <div className="bg-slate-100/90 border-2 border-slate-300 rounded-xl p-2 mb-2 no-print shadow-sm flex items-center gap-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => targetRef.current?.scrollBy({ left: -350, behavior: 'smooth' })}
                className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs flex items-center gap-1 shrink-0 border-slate-300 shadow-sm select-none"
                title="টেবিল বামে সরান"
            >
                <ChevronLeft className="w-4 h-4 text-blue-600" /> বামে
            </Button>

            <div
                ref={topScrollRef}
                onScroll={() => handleScrollSync('top')}
                className="flex-1 overflow-x-scroll permanent-scroll top-scrollbar-track rounded-lg border border-slate-300 bg-white cursor-pointer"
                style={{ height: '24px' }}
                title="স্ক্রোলবারটি ডানে-বামে টেনে পুরো টেবিল সরান"
            >
                <div style={{ width: `${scrollWidth}px`, height: '2px' }} />
            </div>

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => targetRef.current?.scrollBy({ left: 350, behavior: 'smooth' })}
                className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs flex items-center gap-1 shrink-0 border-slate-300 shadow-sm select-none"
                title="টেবিল ডানে সরান"
            >
                ডানে <ChevronRight className="w-4 h-4 text-blue-600" />
            </Button>
        </div>
    );
}
