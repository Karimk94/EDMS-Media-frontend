import React from 'react';
import { SearchBar } from './SearchBar';

import { HeaderProps } from '../../interfaces/PropsInterfaces';

import { useAuth } from '../../hooks/useAuth';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { useQuota } from '../../hooks/useQuota';
import Image from 'next/image';
import { Spinner } from './Spinner';
import { UserAccessBadge } from './UserAccessBadge';
import { QuotaAccessBadge } from './QuotaAccessBadge';

export const Header: React.FC<HeaderProps> = ({
  onSearch,
  onClearCache,
  apiURL,
  onOpenUploadModal,
  isProcessing,
  isEditor,
  t,
  isSidebarOpen,
  toggleSidebar,
  activeSection,
}) => {
  const { user, logout, isLoggingOut } = useAuth();
  const { updateLanguage, updateTheme } = useUserPreferences();
  const { data: quotaData } = useQuota({ enabled: activeSection === 'folders' });

  const lang = user?.lang || 'en';
  const theme = user?.theme || 'light';
  const quota = quotaData?.total ?? user?.quota;
  const remainingQuota = quotaData?.remaining ?? user?.remaining_quota;

  const handleLanguageChange = async () => {
    const newLang = lang === 'en' ? 'ar' : 'en';
    try {
      await updateLanguage(newLang);
    } catch (error) {
      console.error('Failed to update language', error);
    }
  };

  const rtlClass = '';
  const searchBarMargin = 'ml-auto';
  const logoMargin = 'ml-4';

  return (
    <header
      className={`sticky top-0 z-40 bg-[var(--color-bg-header)] border-b border-[var(--color-border-primary)] px-4 sm:px-6 lg:px-8 ${rtlClass}`}
    >
      <div className={`flex items-center justify-between h-16 ${rtlClass}`}>
        <div className={`flex-shrink-0 flex items-center ${rtlClass}`}>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
          >
            <Image src="/icons/menu.svg" alt="" width={24} height={24} className="dark:invert" />
          </button>
          <a href="/dashboard">
            <h1
              className={`text-xl font-bold text-gray-900 dark:text-white ${logoMargin} cursor-pointer`}
            >
              Smart <span className="text-red-500">EDMS</span>
            </h1>
          </a>
          <button
            onClick={handleLanguageChange}
            className={`px-3 py-1.5 bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-white text-sm font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-700 ${logoMargin}`}
          >
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
          {/* Theme Toggle Button */}
          <button
            onClick={() => updateTheme(theme === 'light' ? 'dark' : 'light')}
            className={`p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 ${logoMargin}`}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <Image src="/moon.svg" alt="Dark Mode" width={20} height={20} />
            ) : (
              <Image src="/sun.svg" alt="Light Mode" width={20} height={20} className="invert" />
            )}
          </button>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 flex justify-center px-4 items-center">
          {activeSection !== 'folders'  && (
            <div className="w-full max-w-md">
              <SearchBar onSearch={onSearch} t={t} lang={lang} />
            </div>
          )}
        </div>

        {/* Right Side: Actions */}
        <div
          className={`flex items-center gap-4 ${searchBarMargin} ${rtlClass}`}
        >
          {activeSection === 'folders' && quota !== undefined && remainingQuota !== undefined && (
            <QuotaAccessBadge total={quota} remaining={remainingQuota} t={t} />
          )}
          {isProcessing && (
            <div className="flex items-center gap-2 text-gray-900 dark:text-white text-sm">
              <Spinner size="xs" />
              <span>{t('processing')}</span>
            </div>
          )}
          {isEditor && activeSection !== 'folders'  && (
            <button
              onClick={onOpenUploadModal}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition flex items-center gap-2"
            >
              <Image src="/upload.svg" alt="" width={20} height={20} className="dark:invert" />
              <span>{t('upload')}</span>
            </button>
          )}
          <UserAccessBadge
            user={user}
            lang={lang}
            onLogout={logout}
            logoutText={t('logout')}
            isLoggingOut={isLoggingOut}
            loggingOutText={t('loggingOut')}
          />
        </div>
      </div>
    </header>
  );
};
