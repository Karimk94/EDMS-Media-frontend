"use client";

import React from 'react';

// Define the props for the Sidebar
interface SidebarProps {
  isSidebarOpen: boolean;
  activeSection: 'recent' | 'favorites' | 'events' | 'memories' | 'journey';
  handleSectionChange: (section: 'recent' | 'favorites' | 'events' | 'memories' | 'journey') => void;
  isShowingFullMemories: boolean;
  t: Function;
  lang: 'en' | 'ar';
}

// Reusable navigation link component
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
  
  // Style to make icons white
  const iconFilterStyle = { filter: 'brightness(0) invert(1)' };

  return (
    <button
      onClick={onClick}
      className={`flex items-center w-full p-3 rounded-lg transition-colors duration-150 ease-in-out ${
        isActive ? activeClass : inactiveClass
      } ${rtlClass} ${
        !isSidebarOpen ? 'justify-center' : ''
      } ${
        // UPDATED: Use gap-4 for spacing only when sidebar is open
        isSidebarOpen ? 'gap-4' : ''
      }`}
    >
      <img
        src={icon}
        alt=""
        className={`w-6 h-6 flex-shrink-0 ${
          // UPDATED: Use opacity to dim inactive icons
          isActive ? 'opacity-100' : 'opacity-70'
        }`}
        // UPDATED: Apply filter to all icons
        style={iconFilterStyle}
      />
      {isSidebarOpen && <span className="truncate">{label}</span>}
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
  // Helper to determine the active state correctly
  const getIsActive = (section: 'recent' | 'favorites' | 'events' | 'memories' | 'journey') => {
    if (isShowingFullMemories) {
      return section === 'memories';
    }
    return section === activeSection;
  };

  const sidebarWidth = isSidebarOpen ? 'w-60' : 'w-20';
  const padding = isSidebarOpen ? 'p-4' : 'p-2';
  // Border is now always on the right
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
