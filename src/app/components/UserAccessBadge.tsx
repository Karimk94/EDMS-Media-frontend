import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { LoadingButton } from './LoadingButton';
import { useTranslations, TranslationKey } from '../hooks/useTranslations';

type UserPermission = {
  tab_key: string;
  can_read: boolean;
  can_write: boolean;
};

type HeaderUser = {
  username?: string;
  full_name?: string;
  security_level?: string;
  tab_permissions?: UserPermission[];
};

interface UserAccessBadgeProps {
  user?: HeaderUser;
  lang?: 'en' | 'ar';
  onLogout?: () => void;
  logoutText?: string;
  isLoggingOut?: boolean;
  loggingOutText?: string;
}

const TAB_KEY_MAP: Record<string, TranslationKey> = {
  recent: 'tabRecent',
  favorites: 'tabFavorites',
  folders: 'tabFolders',
  profilesearch: 'tabProfileSearch',
  ems_admin: 'tabEmsAdmin',
};

// Tabs that do not exist in this project and should be hidden from the user access badge.
const HIDDEN_TAB_KEYS = new Set<string>(['profilesearch', 'ems_admin']);

export const UserAccessBadge: React.FC<UserAccessBadgeProps> = ({
  user,
  lang = 'en',
  onLogout,
  logoutText,
  isLoggingOut = false,
  loggingOutText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const t = useTranslations(lang);

  const resolvedLogoutText = logoutText || t('logout');
  const resolvedLoggingOutText = loggingOutText || t('loggingOut');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  if (!user?.username) {
    return null;
  }

  const tabPermissions = user.tab_permissions ?? [];

  const formatTabLabel = (tabKey: string): string => {
    const translationKey = TAB_KEY_MAP[tabKey];
    if (translationKey) {
      return t(translationKey);
    }
    return tabKey
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const formatAccess = (permission: UserPermission): string => {
    if (permission.can_write) return t('readWrite');
    if (permission.can_read) return t('readOnly');
    return t('noAccess');
  };

  return (
    <div ref={wrapperRef} className="relative group">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-semibold">
          {(user.full_name || user.username).charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[120px] truncate font-medium">{user.full_name || user.username}</span>
      </button>

      <div
        className={`absolute right-0 rtl:right-auto rtl:left-0 top-full pt-2 w-72 z-50 transition-all duration-150 ${
          isOpen ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-1'
        } group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0`}
      >
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
          <div className="p-3 text-sm space-y-3">
            {/* User Details: Full Name & Username */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold text-base">
                {(user.full_name || user.username).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('fullName')}</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {user.full_name || user.username}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">{t('username')}</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {user.username}
                </p>
              </div>
            </div>

            {/* Security Level */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('securityLevel')}</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {user.security_level || 'N/A'}
              </p>
            </div>

            {/* Tab Access */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">{t('tabAccess')}</p>
              {tabPermissions.filter((p) => (p.can_read || p.can_write) && !HIDDEN_TAB_KEYS.has(p.tab_key)).length === 0 ? (
                <p className="text-gray-700 dark:text-gray-300">{t('noTabPermissions')}</p>
              ) : (
                <ul className="space-y-1 max-h-48 overflow-auto pr-1">
                  {tabPermissions
                    .filter((p) => (p.can_read || p.can_write) && !HIDDEN_TAB_KEYS.has(p.tab_key))
                    .map((permission) => (
                      <li
                        key={permission.tab_key}
                        className="flex items-center justify-between text-gray-800 dark:text-gray-200"
                      >
                        <span>{formatTabLabel(permission.tab_key)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {formatAccess(permission)}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>

          {onLogout && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-2">
              <LoadingButton
                onClick={() => {
                  if (isLoggingOut) {
                    return;
                  }
                  setIsOpen(false);
                  onLogout();
                }}
                isLoading={isLoggingOut}
                loadingText={resolvedLoggingOutText}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {!isLoggingOut && (
                  <Image src="/logout.svg" alt="Logout" width={18} height={18} className="dark:brightness-0 dark:invert" />
                )}
                {resolvedLogoutText}
              </LoadingButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
