"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '../hooks/useTranslations';
import HtmlLangUpdater from '../components/HtmlLangUpdater';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  
  const [lang, setLang] = useState<'en' | 'ar'>('en'); 
  const t = useTranslations(lang);
  
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
          router.push('/');
        } else {
          setIsChecking(false);
        }
      } catch (err) {
        setIsChecking(false);
      }
    };

    checkSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        router.push('/');
      } else {
        const data = await response.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'ar' : 'en');
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <div>{t('loading')}</div>
      </div>
    );
  }

  return (
    <>
      <HtmlLangUpdater lang={lang} />
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white relative">
        {/* Language Toggle Button */}
        <button
          onClick={toggleLanguage}
          className="absolute top-4 right-4 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium text-sm"
        >
          {lang === 'en' ? 'العربية' : 'English'}
        </button>

        <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center">{t('loginTitle')}</h1>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="username"
                className="block mb-2 text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                {t('username')}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-red-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block mb-2 text-sm font-medium text-gray-600 dark:text-gray-400"
              >
                {t('password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-red-500 focus:outline-none"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 rounded-md font-semibold text-white disabled:bg-red-800"
            >
              {isLoading ? t('loggingIn') : t('login')}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}