"use client";

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function PwaRegister() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // 1. Initialize Theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }

    // 2. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('PWA Service Worker registered successfully:', reg.scope);
          })
          .catch((err) => {
            console.warn('PWA Service Worker registration failed:', err);
          });
      });
    }

    // 3. Online/Offline Listeners
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    if (typeof window !== 'undefined') {
      if (!navigator.onLine) {
        setIsOffline(true);
      }
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  if (isOffline) {
    return (
      <div className="fixed bottom-16 md:bottom-6 right-4 z-50 bg-rose-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-black animate-fade-in border-2 border-white/30 backdrop-blur-md">
        <WifiOff className="w-4 h-4 animate-pulse text-yellow-300" />
        <span>আপনি অফলাইনে আছেন (ক্যাশ মোড চালু)</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="fixed bottom-16 md:bottom-6 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-black animate-fade-in border-2 border-white/30 backdrop-blur-md">
        <Wifi className="w-4 h-4 text-emerald-200" />
        <span>ইন্টারনেট পুনঃসংযোগ হয়েছে</span>
      </div>
    );
  }

  return null;
}
