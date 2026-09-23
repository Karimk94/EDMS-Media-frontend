"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface TabPermission {
    tab_key: string;
    can_read: boolean;
    can_write: boolean;
}

interface User {
    username: string;
    security_level: string;
    lang: 'en' | 'ar';
    theme: 'light' | 'dark';
    quota: number;
    remaining_quota: number;
    view_mode?: 'grid' | 'list';
    tab_permissions?: TabPermission[];
}

type SectionKey = 'recent' | 'favorites' | 'folders';

interface UserContextType {
    user: User | undefined;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (credentials: any) => Promise<any>;
    logout: () => Promise<void>;
    currentLang: 'en' | 'ar';
    currentTheme: 'light' | 'dark';
    allowedSections: SectionKey[];
    writableSections: SectionKey[];
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const { user, isLoadingUser, login, logout, isAuthenticated } = useAuth();
    const [isClient, setIsClient] = useState(false);

    const [currentLang, setCurrentLang] = useState<'en' | 'ar'>('en');
    const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');

    // Run once on mount to grab localStorage and avoid hydration mismatch
    useEffect(() => {
        setIsClient(true);
        const storedLang = localStorage.getItem('lang') as 'en' | 'ar';
        if (storedLang) {
            setCurrentLang(storedLang);
            document.documentElement.lang = storedLang;
            document.documentElement.dir = 'ltr';
        }
        const storedTheme = localStorage.getItem('theme') as 'light' | 'dark';
        if (storedTheme) {
            setCurrentTheme(storedTheme);
        }
    }, []);

    // Apply theme globally when user is loaded
    useEffect(() => {
        if (user?.theme) {
            setCurrentTheme(user.theme);
            localStorage.setItem('theme', user.theme);
            if (user.theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }, [user?.theme]);

    // Apply language globally when user is loaded
    useEffect(() => {
        if (user?.lang) {
            setCurrentLang(user.lang);
            localStorage.setItem('lang', user.lang);
            document.documentElement.lang = user.lang;
            document.documentElement.dir = 'ltr';
        }
    }, [user?.lang]);

    // Compute allowed and writable sections from tab_permissions
    // 'favorites' is merged with 'recent' — one toggle controls both
    const allSections: SectionKey[] = ['recent', 'favorites', 'folders'];

    const allowedSections: SectionKey[] = user?.tab_permissions
        ? (() => {
            const allowed = user.tab_permissions
                .filter(p => p.can_read)
                .map(p => p.tab_key as SectionKey)
                .filter(s => allSections.includes(s));
            // If 'recent' is allowed, also allow 'favorites' (merged)
            if (allowed.includes('recent') && !allowed.includes('favorites')) {
                allowed.push('favorites');
            }
            return allowed;
        })()
        : allSections; // Default: show all if no permissions data yet

    // Write access is determined ENTIRELY by per-tab permissions
    // (tab_permissions.can_write). The global security_level (Editor/Viewer)
    // has no power here — each tab's access is controlled independently.
    // When tab_permissions are not yet loaded, default to no write access.
    const writableSections: SectionKey[] = user?.tab_permissions
        ? (() => {
            const writable = user.tab_permissions
                .filter(p => p.can_write)
                .map(p => p.tab_key as SectionKey)
                .filter(s => allSections.includes(s));
            // If 'recent' is writable, also make 'favorites' writable
            if (writable.includes('recent') && !writable.includes('favorites')) {
                writable.push('favorites');
            }
            return writable;
        })()
        : [];

    const value = {
        user,
        isLoading: isLoadingUser,
        isAuthenticated,
        login,
        logout,
        currentLang,
        currentTheme,
        allowedSections,
        writableSections
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
