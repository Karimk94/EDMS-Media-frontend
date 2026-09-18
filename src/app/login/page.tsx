"use client";

import Image from 'next/image';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '../hooks/useTranslations';
import HtmlLangUpdater from '../components/HtmlLangUpdater';
import { useUser } from '../context/UserContext';
import { useQueryClient } from '@tanstack/react-query';

function getSafeRedirect(redirect: string | null): string {
  if (!redirect) return '/';
  // Must start with '/' and not '//' (prevents open redirects)
  if (!redirect.startsWith('/') || redirect.startsWith('//')) return '/';
  // Must not redirect to login page itself (prevents redirect loop)
  if (redirect.startsWith('/login')) return '/';
  return redirect;
}

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [lang, setLang] = useState<'en' | 'ar'>('en'); 
  const t = useTranslations(lang);
  
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const destinationUrl = getSafeRedirect(rawRedirect);

  const { isAuthenticated, isLoading: isLoadingUser, login } = useUser();
  const queryClient = useQueryClient();

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (!isLoadingUser && isAuthenticated) {
      window.location.href = destinationUrl;
    }
  }, [isAuthenticated, isLoadingUser, destinationUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const data = await login({ username, password });
      if (data?.user) {
        queryClient.setQueryData(['user'], data.user);
      }
      queryClient.invalidateQueries({ queryKey: ['user'] });
      // Perform full navigation so all authenticated states and queries cleanly initialize
      window.location.href = destinationUrl;
    } catch (err: any) {
      const errMsg = err?.data?.detail || err?.data?.error || err?.message || 'Login failed';
      setError(errMsg);
      setIsLoading(false);
    }
  };

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'ar' : 'en');
  };

  // Show loading while checking existing session or while redirecting
  if (isLoadingUser || isAuthenticated) {
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

        <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="flex justify-center mb-2">
            <Image src="/logo.png" alt="Company Logo" width={140} height={56} className="h-14 w-auto object-contain" priority />
          </div>
          <h1 className="text-2xl font-bold text-center">Smart <span className="text-blue-500">EDMS Media</span> {t('login')}</h1>
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
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:outline-none"
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
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:outline-none"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold text-white disabled:bg-blue-800"
            >
              {isLoading ? t('loggingIn') : t('login')}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <div>Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}