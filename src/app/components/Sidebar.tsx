"use client";

import Image from 'next/image';
import React from 'react';
import { SidebarProps } from '../../interfaces/PropsInterfaces';
import { AdminSidebarItem } from './AdminSidebarItem';

const NavLink: React.FC<{
  icon: string;
  label: string;
  isActive: boolean;
  isSidebarOpen: boolean;
  onClick: () => void;
  lang: 'en' | 'ar';
}> = ({ icon, label, isActive, isSidebarOpen, onClick, lang }) => {
  const activeClass = 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white';
  const inactiveClass = 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white';
  const rtlClass = '';

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`relative flex items-center w-full p-3 rounded-lg transition-colors duration-150 ease-in-out group ${isActive ? activeClass : inactiveClass
        } ${rtlClass} ${!isSidebarOpen ? 'justify-center' : ''
        } ${isSidebarOpen ? 'gap-4' : ''
        }`}
    >
      <Image
        src={icon}
        alt=""
        width={24}
        height={24}
        className={`flex-shrink-0 dark:brightness-0 dark:invert ${isActive ? 'opacity-100' : 'opacity-70'
          }`}
      />
      {isSidebarOpen && <span className="truncate">{label}</span>}

      {!isSidebarOpen && (
        <span
          className={`absolute top-1/2 -translate-y-1/2 z-50
                     bg-white text-gray-900 border border-gray-200 shadow-lg dark:bg-gray-900 dark:text-white dark:border-gray-700 
                     px-3 py-1 rounded-md text-sm font-medium
                     opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100
                     transition-all duration-150 pointer-events-none whitespace-nowrap left-full ml-4
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
  hiddenSections = [],
}) => {
  const getIsActive = (section: 'recent' | 'favorites' | 'folders') => {
    return section === activeSection;
  };

  const sidebarWidth = isSidebarOpen ? 'w-60' : 'w-20';
  const padding = isSidebarOpen ? 'p-4' : 'p-3';
  const borderClass = 'border-r';

  // Define all nav items
  const navItems: { section: 'recent' | 'favorites' | 'folders'; icon: string; labelKey: string }[] = [
    { section: 'recent', icon: '/clock.svg', labelKey: 'recentlyAdded' },
    { section: 'favorites', icon: '/star.svg', labelKey: 'favorites' },
    { section: 'folders', icon: '/folder.svg', labelKey: 'folders' },
  ];

  // Filter out hidden sections
  const visibleItems = navItems.filter(item => !hiddenSections.includes(item.section));

  return (
    <aside
      className={`flex-shrink-0 bg-[var(--color-bg-sidebar)] ${sidebarWidth} ${padding} transition-all duration-300 ease-in-out flex flex-col ${borderClass} border-[var(--color-border-primary)]`}
    >
      <nav className="flex-1 space-y-2">
        {visibleItems.map(item => (
          <NavLink
            key={item.section}
            icon={item.icon}
            label={t(item.labelKey)}
            isActive={getIsActive(item.section)}
            isSidebarOpen={isSidebarOpen}
            onClick={() => handleSectionChange(item.section)}
            lang={lang}
          />
        ))}
      </nav>

      {/* Admin Section */}
      <div className="border-t border-[var(--color-border-primary)] pt-2 space-y-2">
        <AdminSidebarItem isSidebarOpen={isSidebarOpen} lang={lang} />
      </div>
    </aside>
  );
};


