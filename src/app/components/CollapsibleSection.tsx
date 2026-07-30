import React, { useState } from 'react';
import { CollapsibleSectionProps } from '../../interfaces/PropsInterfaces';
import Image from 'next/image';

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, theme }) => {
  const [isOpen, setIsOpen] = useState(true);

  const wrapperBg = theme === 'dark' ? 'bg-[#1f1f1f]' : 'bg-gray-50';
  const buttonHoverBg = theme === 'dark' ? 'hover:bg-[#2a2a2a]' : 'hover:bg-gray-100';
  const buttonTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className={`${wrapperBg} rounded-lg`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center p-4 text-left font-semibold ${buttonTextColor} ${buttonHoverBg} rounded-t-lg focus:outline-none transition-colors`}
      >
        <span>{title}</span>
        <Image src="/icons/chevron-down.svg" alt="" width={20} height={20} className={`dark:invert transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-screen' : 'max-h-0'}`}>
        <div className={`p-4 border-t ${borderColor}`}>
          {children}
        </div>
      </div>
    </div>
  );
};