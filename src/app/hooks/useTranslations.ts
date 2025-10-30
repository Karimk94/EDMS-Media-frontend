import en from '../../locales/en.json';
import ar from '../../locales/ar.json';

const translations = { en, ar };

// Define a type that includes all possible translation keys from your en.json file
export type TranslationKey = keyof typeof en;

// Define a reusable type for the translation function
export type TFunction = (key: TranslationKey) => string;

export const useTranslations = (lang: 'en' | 'ar' = 'en'): TFunction => {
  return (key: TranslationKey) => {
    // This casting ensures that even if 'ar' is missing a key, it won't crash
    return (translations[lang] as Record<TranslationKey, string>)[key] || key;
  };
};