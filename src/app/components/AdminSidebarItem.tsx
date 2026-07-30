'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface AdminSidebarItemProps {
  isSidebarOpen: boolean;
  lang: 'en' | 'ar';
}

export const AdminSidebarItem: React.FC<AdminSidebarItemProps> = ({ isSidebarOpen, lang }) => {
  const router = useRouter();
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const response = await fetch('/api/admin/check-access', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setHasAdminAccess(data.has_access === true);
        }
      } catch (error) {
        console.error('Error checking admin access:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkAdminAccess();
  }, []);

  if (isChecking || !hasAdminAccess) {
    return null;
  }

  const inactiveClass = 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white';

  return (
    <button
      onClick={() => router.push('/admin')}
      className={`relative flex items-center w-full p-3 rounded-lg transition-colors duration-150 ease-in-out group ${inactiveClass} ${!isSidebarOpen ? 'justify-center' : ''} ${isSidebarOpen ? 'gap-4' : ''}`}
    >
      <Image
        src="/admin-icon.svg"
        alt=""
        width={24}
        height={24}
        className="flex-shrink-0 dark:brightness-0 dark:invert opacity-70"
      />
      {isSidebarOpen && <span className="truncate">Admin</span>}

      {!isSidebarOpen && (
        <span
          className={`absolute top-1/2 -translate-y-1/2 z-50
                     bg-white text-gray-900 border border-gray-200 shadow-lg dark:bg-gray-900 dark:text-white dark:border-gray-700 
                     px-3 py-1 rounded-md text-sm font-medium
                     opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100
                     transition-all duration-150 pointer-events-none whitespace-nowrap left-full ml-4
                    `}
        >
          Admin
        </span>
      )}
    </button>
  );
};
