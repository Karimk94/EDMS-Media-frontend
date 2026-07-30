import React, { useState, useMemo, useEffect } from 'react';
import { useAdmin } from '../../../hooks/useAdmin';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslations } from '../../hooks/useTranslations';
import { Spinner } from '../../components/Spinner';

// Debounce hook to avoid excessive API calls while typing
function useDebounce(value: string, delay: number = 300): string {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}

export default function ProfilesTab() {
    const { user } = useAuth();
    const lang = user?.lang || 'en';
    const t = useTranslations(lang as 'en' | 'ar');

    const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

    // Search states (immediate input)
    const [profileSearch, setProfileSearch] = useState('');
    const [groupSearch, setGroupSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');

    // Debounced values for API calls
    const debouncedProfileSearch = useDebounce(profileSearch);
    const debouncedGroupSearch = useDebounce(groupSearch);
    const debouncedUserSearch = useDebounce(userSearch);

    const { useAdminProfiles, useProfileGroups, useGroupUsers } = useAdmin();

    const { data: profiles, isLoading: isLoadingProfiles } = useAdminProfiles(debouncedProfileSearch);
    const { data: groups, isLoading: isLoadingGroups } = useProfileGroups(selectedProfileId, debouncedGroupSearch);
    const { data: users, isLoading: isLoadingUsers } = useGroupUsers(selectedGroupId, debouncedUserSearch);

    // Deduplicate groups by system_id (safety net)
    const uniqueGroups = useMemo(() => {
        if (!groups) return [];
        const seen = new Set<number>();
        return groups.filter((g: any) => {
            if (seen.has(g.system_id)) return false;
            seen.add(g.system_id);
            return true;
        });
    }, [groups]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden h-[calc(100vh-130px)] flex flex-col md:flex-row">
            {/* Profiles Column */}
            <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 flex flex-col h-1/3 md:h-full">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('adminProfiles')}</h3>
                    <input
                        type="text"
                        value={profileSearch}
                        onChange={(e) => setProfileSearch(e.target.value)}
                        placeholder={t('search')}
                        className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {isLoadingProfiles ? (
                        <div className="p-4 flex justify-center"><Spinner size="sm" center={false} /></div>
                    ) : (profiles?.length ?? 0) === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">{t('noProfilesFound')}</div>
                    ) : (
                        profiles?.map((profile: any) => (
                            <button
                                key={profile.system_id}
                                onClick={() => {
                                    setSelectedProfileId(profile.system_id);
                                    setSelectedGroupId(null);
                                    setGroupSearch('');
                                    setUserSearch('');
                                }}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedProfileId === profile.system_id ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                            >
                                <div className="truncate">{profile.form_name}</div>
                                {profile.form_title && <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{profile.form_title}</div>}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Groups Column */}
            <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 flex flex-col h-1/3 md:h-full">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('adminGroups')}</h3>
                    <input
                        type="text"
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        placeholder={t('search')}
                        disabled={!selectedProfileId}
                        className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {!selectedProfileId ? (
                        <div className="p-4 text-center text-gray-500 text-sm">{t('selectProfileToViewGroups')}</div>
                    ) : isLoadingGroups ? (
                        <div className="p-4 flex justify-center"><Spinner size="sm" center={false} /></div>
                    ) : uniqueGroups.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">{t('noGroupsFoundForProfile')}</div>
                    ) : (
                        uniqueGroups.map((group: any) => (
                            <button
                                key={group.system_id}
                                onClick={() => {
                                    setSelectedGroupId(group.system_id);
                                    setUserSearch('');
                                }}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedGroupId === group.system_id ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                            >
                                <div className="truncate">{group.group_name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{group.group_id}</div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Users Column */}
            <div className="w-full md:w-1/3 flex flex-col h-1/3 md:h-full">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('adminUsers')}</h3>
                    <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder={t('search')}
                        disabled={!selectedGroupId}
                        className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {!selectedGroupId ? (
                        <div className="p-4 text-center text-gray-500 text-sm">{t('selectGroupToViewUsers')}</div>
                    ) : isLoadingUsers ? (
                        <div className="p-4 flex justify-center"><Spinner size="sm" center={false} /></div>
                    ) : (users?.length ?? 0) === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">{t('noUsersFoundInGroup')}</div>
                    ) : (
                        users?.map((u: any) => (
                            <div
                                key={u.system_id}
                                className="px-3 py-2 rounded-md text-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm mb-1"
                            >
                                <div className="font-medium text-gray-900 dark:text-white truncate">{u.full_name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{u.user_id}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
