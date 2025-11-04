"use client";

import React from 'react';

interface SidebarProps {
  isSidebarOpen: boolean;
  activeSection: 'recent' | 'favorites' | 'events' | 'memories' | 'journey';
  handleSectionChange: (section: 'recent' | 'favorites' | 'events' | 'memories' | 'journey') => void;
  isShowingFullMemories: boolean;
  t: Function;
  lang: 'en' | 'ar';
}

const NavLink: React.FC<{
  icon: string;
  label: string;
  isActive: boolean;
  isSidebarOpen: boolean;
  onClick: () => void;
  lang: 'en' | 'ar';
}> = ({ icon, label, isActive, isSidebarOpen, onClick, lang }) => {
  const activeClass = 'bg-gray-700 text-white';
  const inactiveClass = 'text-gray-400 hover:bg-gray-700 hover:text-white';
  const rtlClass = lang === 'ar' ? 'flex-row-reverse' : '';
  
  const iconFilterStyle = { filter: 'brightness(0) invert(1)' };

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center w-full p-3 rounded-lg transition-colors duration-150 ease-in-out group ${
        isActive ? activeClass : inactiveClass
      } ${rtlClass} ${
        !isSidebarOpen ? 'justify-center' : ''
      } ${
        isSidebarOpen ? 'gap-4' : ''
      }`}
    >
      <img
        src={icon}
        alt=""
        className={`w-6 h-6 flex-shrink-0 ${
          isActive ? 'opacity-100' : 'opacity-70'
        }`}
        style={iconFilterStyle}
      />
      {isSidebarOpen && <span className="truncate">{label}</span>}
      
      {!isSidebarOpen && (
        <span 
          className={`absolute top-1/2 -translate-y-1/2 z-50
                     bg-gray-900 text-white px-3 py-1 rounded-md text-sm font-medium
                     opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100
                     transition-all duration-150 pointer-events-none whitespace-nowrap
                     left-full ml-4
                    `}
        >
          {label}
        </span>
      )}
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  activeSection,
  handleSectionChange,
  isShowingFullMemories,
  t,
  lang,
}) => {
  const getIsActive = (section: 'recent' | 'favorites' | 'events' | 'memories' | 'journey') => {
    if (isShowingFullMemories) {
      return section === 'memories';
    }
    return section === activeSection;
  };

  const sidebarWidth = isSidebarOpen ? 'w-60' : 'w-20';
  const padding = isSidebarOpen ? 'p-4' : 'p-2';
  const borderClass = 'border-r';

  return (
    <aside
      className={`flex-shrink-0 bg-[#212121] text-white ${sidebarWidth} ${padding} transition-all duration-300 ease-in-out flex flex-col ${borderClass} border-gray-700`}
    >
      <nav className="flex-1 space-y-2">
        <NavLink
          icon="/clock.svg"
          label={t('recentlyAdded')}
          isActive={getIsActive('recent')}
          isSidebarOpen={isSidebarOpen}
          onClick={() => handleSectionChange('recent')}
          lang={lang}
        />
        <NavLink
          icon="/star.svg"
          label={t('favorites')}
          isActive={getIsActive('favorites')}
          isSidebarOpen={isSidebarOpen}
          onClick={() => handleSectionChange('favorites')}
          lang={lang}
        />
        <NavLink
          icon="/history-calendar.svg"
          label={t('events')}
          isActive={getIsActive('events')}
          isSidebarOpen={isSidebarOpen}
          onClick={() => handleSectionChange('events')}
          lang={lang}
        />
        <NavLink
          icon="/history.svg"
          label={t('memories')}
          isActive={getIsActive('memories')}
          isSidebarOpen={isSidebarOpen}
          onClick={() => handleSectionChange('memories')}
          lang={lang}
        />
        <NavLink
          icon="/journey.svg"
          label={t('journey')}
          isActive={getIsActive('journey')}
          isSidebarOpen={isSidebarOpen}
          onClick={() => handleSectionChange('journey')}
          lang={lang}
        />
      </nav>
    </aside>
  );
};