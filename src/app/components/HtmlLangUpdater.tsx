"use client";

import { useEffect } from 'react';

interface HtmlLangUpdaterProps {
  lang: 'en' | 'ar';
}

const HtmlLangUpdater: React.FC<HtmlLangUpdaterProps> = ({ lang }) => {
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  return null; // This component does not render anything
};

export default HtmlLangUpdater;