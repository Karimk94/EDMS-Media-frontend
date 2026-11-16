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
  const [ssoError, setSsoError] = useState<string | null>(null);

  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const t = useTranslations(lang);

  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const destinationUrl = getSafeRedirect(rawRedirect);

  const { isAuthenticated, isLoading: isLoadingUser, login, ssoLogin, isSsoLoggingIn } = useUser();
  const queryClient = useQueryClient();

  useEffect(() => {
    const savedLang = localStorage.getItem('lang') as 'en' | 'ar';
    const paramLang = searchParams.get('lang') as 'en' | 'ar';
    const finalLang = paramLang || savedLang || 'en';
    if (finalLang) {
      setLang(finalLang);
    }
  }, [searchParams]);

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (!isLoadingUser && isAuthenticated) {
      window.location.href = destinationUrl;
    }
  }, [isAuthenticated, isLoadingUser, destinationUrl]);

  const handleSsoLogin = async () => {
    setSsoError(null);
    setError('');
    try {
      if (!ssoLogin) return;
      const data = await ssoLogin();
      if (data?.user) {
        if (data.user.lang) {
          setLang(data.user.lang);
          localStorage.setItem('lang', data.user.lang);
        }
        if (data.user.theme) {
          localStorage.setItem('theme', data.user.theme);
        }
        queryClient.setQueryData(['user'], data.user);
      }
      queryClient.invalidateQueries({ queryKey: ['user'] });
      window.location.href = destinationUrl;
    } catch (err: any) {
      console.error('SSO Login exception:', err);
      const detail = err?.data?.detail || err?.data?.error || err?.message || t('ssoError');
      setSsoError(detail);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSsoError(null);

    try {
      const data = await login({ username, password });
      if (data?.user) {
        if (data.user.lang) {
          setLang(data.user.lang);
          localStorage.setItem('lang', data.user.lang);
        }
        if (data.user.theme) {
          localStorage.setItem('theme', data.user.theme);
        }
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
    setLang(prev => {
      const next = prev === 'en' ? 'ar' : 'en';
      localStorage.setItem('lang', next);
      return next;
    });
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

          {/* SSO / IAM Login */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleSsoLogin}
              disabled={isSsoLoggingIn || isLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-md shadow-sm transition duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSsoLoggingIn ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{t('ssoLoggingIn')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>{t('ssoLogin')}</span>
                </>
              )}
            </button>

            {ssoError && (
              <div className="p-3 text-xs text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800">
                {ssoError}
              </div>
            )}

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-gray-300 dark:border-gray-600 w-full"></div>
              <span className="bg-white dark:bg-gray-800 px-3 text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                {t('orDivider')}
              </span>
              <div className="border-t border-gray-300 dark:border-gray-600 w-full"></div>
            </div>
          </div>

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
              disabled={isLoading || isSsoLoggingIn}
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
