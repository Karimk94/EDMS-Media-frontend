"use client";

import { useEffect } from 'react';

interface HtmlThemeUpdaterProps {
  theme: 'light' | 'dark';
}

const HtmlThemeUpdater: React.FC<HtmlThemeUpdaterProps> = ({ theme }) => {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return null;
};

export default HtmlThemeUpdater;