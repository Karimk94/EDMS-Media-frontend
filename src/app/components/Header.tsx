import React from 'react';
import { SearchBar } from './SearchBar';
import Link from 'next/link';

interface PersonOption {
  value: number;
  label: string;
}

interface HeaderProps {
  onSearch: (searchTerm: string) => void;
  onClearCache: () => void;
  lang: 'en' | 'ar';
  setLang: (lang: 'en' | 'ar') => void;
  t: Function;
  apiURL: string;
  onOpenUploadModal: () => void;
  isProcessing: boolean;
  onLogout: () => void;
  isEditor: boolean;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSearch,
  onClearCache,
  apiURL,
  onOpenUploadModal,
  isProcessing,
  onLogout,
  isEditor,
  lang,
  setLang,
  t,
  isSidebarOpen,
  toggleSidebar,
}) => {
  const handleLanguageChange = async () => {
    const newLang = lang === 'en' ? 'ar' : 'en';
    try {
      await fetch('/api/user/language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: newLang }),
      });
      setLang(newLang);
    } catch (error) {
      console.error('Failed to update language', error);
    }
  };

  // Determine flex-row-reverse for RTL
  const rtlClass = lang === 'ar' ? 'flex-row-reverse' : '';
  const searchBarMargin = lang === 'ar' ? 'mr-auto' : 'ml-auto';
  const logoMargin = lang === 'ar' ? 'mr-4' : 'ml-4';

  return (
    <header
      className={`sticky top-0 z-40 bg-[#212121] border-b border-gray-700 px-4 sm:px-6 lg:px-8 ${rtlClass}`}
    >
      <div className={`flex items-center justify-between h-16 ${rtlClass}`}>
        {/* Left Side: Toggle, Logo, Lang */}
        <div className={`flex-shrink-0 flex items-center ${rtlClass}`}>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700"
            aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              ></path>
            </svg>
          </button>
          <Link href="/">
            <h1 className={`text-xl font-bold text-white ${logoMargin} cursor-pointer`}>
              <span className="text-red-500">EDMS</span> Media
            </h1>
          </Link>
          <button
            onClick={handleLanguageChange}
            className={`px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 ${logoMargin}`}
          >
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 flex justify-center px-4 items-center">
          <div className="w-full max-w-md">
            <SearchBar onSearch={onSearch} t={t} lang={lang} />
          </div>
        </div>

        {/* Right Side: Actions */}
        <div
          className={`flex items-center gap-4 ${searchBarMargin} ${rtlClass}`}
        >
          {isProcessing && (
            <div className="flex items-center gap-2 text-white text-sm">
              <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
              <span>{t('processing')}</span>
            </div>
          )}
          {isEditor && (
            <button
              onClick={onOpenUploadModal}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{t('upload')}</span>
            </button>
          )}
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition flex items-center gap-2"
          >
            <img src="/logout.svg" alt="Logout" className="h-5 w-5" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};