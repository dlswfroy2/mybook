"use client";

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasDarkClass = document.documentElement.classList.contains('dark');
    setIsDark(hasDarkClass);
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={className || "h-8 w-8 text-white hover:bg-white/10 rounded-xl"}
        aria-label="Toggle theme"
      >
        <span className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={className || "h-8 w-8 text-white hover:bg-white/10 rounded-xl transition-all duration-300 relative"}
      title={isDark ? "লাইট মোডে পরিবর্তন করুন" : "ডার্ক মোডে পরিবর্তন করুন"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-yellow-300 transition-transform duration-300 hover:rotate-90 drop-shadow" />
      ) : (
        <Moon className="w-4 h-4 text-white/90 transition-transform duration-300 hover:-rotate-12 drop-shadow" />
      )}
    </Button>
  );
}
