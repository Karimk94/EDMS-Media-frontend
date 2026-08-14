"use client";

import { useRouter } from "next/navigation";
import Image from 'next/image';
import { useEffect, useState } from "react";
import { EdmsUser, PersonResult, useAdmin } from "../../hooks/useAdmin";
import QuotaPieChart from "../components/QuotaPieChart";
import { PageSpinner, Spinner } from "../components/Spinner";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";
import { useTranslations } from "../hooks/useTranslations";

const ITEMS_PER_PAGE = 20;

const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'ar', name: 'Arabic' }
];

const THEMES = [
    { code: 'light', name: 'Light' },
    { code: 'dark', name: 'Dark' }
];

type AdminTabKey = 'recent' | 'folders' | 'profilesearch' | 'ems_admin';

const TAB_PERMISSION_ITEMS: { key: AdminTabKey; label: string }[] = [
    { key: 'recent', label: 'Smart EDMS & Favorites' },
    { key: 'folders', label: 'Folders' },
    { key: 'profilesearch', label: 'Profile Search' },
    { key: 'ems_admin', label: 'EMS Admin' },
];

type TabToggleState = { can_read: boolean; can_write: boolean };
type AddTabPermissionsState = Record<AdminTabKey, TabToggleState>;

const createDefaultAddTabPermissions = (): AddTabPermissionsState => ({
    recent: { can_read: true, can_write: false },
    folders: { can_read: true, can_write: false },
    profilesearch: { can_read: true, can_write: false },
    ems_admin: { can_read: false, can_write: false },
});

export default function AdminPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);

    const { user } = useAuth();
    const lang = user?.lang || 'en';
    const t = useTranslations(lang as 'en' | 'ar');

    // Queries & Mutations from hook
    const {
        useCheckAccess,
        useUsers,
        useSecurityLevels,
        useSearchPeople,
        useProcessingQueueStatus,
        useTabPermissions,
        retryFailedQueue,
        isRetryingFailedQueue,
        retrySelectedQueue,
        isRetryingSelectedQueue,
        clearCompletedQueue,
        isClearingCompletedQueue,
        addUser,
        isAddingUser,
        updateUser,
        isUpdatingUser,
        deleteUser,
        isDeletingUser,
        upsertTabPermission,
        isUpsertingTabPermission,
        initTabPermissions
    } = useAdmin();

    const { data: accessData, isLoading: checkingAccess } = useCheckAccess();

    // Server-side pagination and search
    const [userFilter, setUserFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    // Users Query
    const { data: usersData, isLoading: isLoadingUsers } = useUsers(currentPage, userFilter, !!hasAccess);
    const users = usersData?.users || [];
    const totalUsers = usersData?.total || 0;
    const hasMore = usersData?.has_more || false;

    // Security Levels Query
    const { data: securityLevels = [] } = useSecurityLevels(!!hasAccess);

    // Queue status polling
    const {
        data: queueStatus,
        isLoading: isQueueLoading,
        isFetching: isQueueFetching,
        refetch: refetchQueueStatus,
    } = useProcessingQueueStatus(!!hasAccess);


    // Add user modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
    const [selectedSecurityLevel, setSelectedSecurityLevel] = useState<number | null>(null);
    const [selectedLang, setSelectedLang] = useState("en");
    const [selectedTheme, setSelectedTheme] = useState("light");
    const [selectedAllowLargeDownloads, setSelectedAllowLargeDownloads] = useState(false);
    const [addTabPermissions, setAddTabPermissions] = useState<AddTabPermissionsState>(createDefaultAddTabPermissions);

    // People Search Query
    const { data: searchResults = [], isLoading: isSearching } = useSearchPeople(searchQuery, showAddModal);

    // Edit user modal
    const [editTarget, setEditTarget] = useState<EdmsUser | null>(null);
    const [editSecurityLevel, setEditSecurityLevel] = useState<number | null>(null);
    const [editLang, setEditLang] = useState("en");
    const [editTheme, setEditTheme] = useState("light");
    const [editQuota, setEditQuota] = useState<number | null>(null);
    const [editTotalQuota, setEditTotalQuota] = useState<number | null>(null);
    const [editAllowLargeDownloads, setEditAllowLargeDownloads] = useState(false);

    // Tab Permissions Query (per-user, only when editing a user)
    const { data: editUserTabPerms = [] } = useTabPermissions(
        editTarget?.people_system_id ?? null, !!editTarget
    );

    // Format quota helper
    const formatQuota = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<EdmsUser | null>(null);
    const [retryingDocnumber, setRetryingDocnumber] = useState<number | null>(null);
    const [expandedErrorRows, setExpandedErrorRows] = useState<Record<number, boolean>>({});
    const [queueViewFilter, setQueueViewFilter] = useState<'failed' | 'in_progress' | 'queued'>('failed');
    const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'worker'>('users');

    const router = useRouter();
    const { showToast } = useToast();

    // Calculate total pages
    const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE);

    // Check access side effect
    useEffect(() => {
        if (accessData) {
            setHasAccess(accessData.has_access);
            setIsLoading(false);
            if (!accessData.has_access) {
                // Optional: redirect logic could go here, but let's keep the error UI
            }
        } else if (!checkingAccess && !accessData) {
            setIsLoading(false); // Finished checking, no data (error handled by query)
        }
    }, [accessData, checkingAccess]);

    // Handle Access Error Redirect (optional, based on requirement)
    // useEffect(() => { ... }, [accessError]); 

    // Debounced search for user list - reset to page 1
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [userFilter]);

    const handleAddUser = async () => {
        if (!selectedPerson || !selectedSecurityLevel) {
            showToast("Please select a user and security level", "error");
            return;
        }

        try {
            await addUser({
                user_system_id: selectedPerson.system_id,
                security_level_id: selectedSecurityLevel,
                lang: selectedLang,
                theme: selectedTheme,
                allow_large_downloads: selectedAllowLargeDownloads,
            });

            // Create default tab permissions for the new user
            try {
                await initTabPermissions(selectedPerson.system_id);

                for (const { key } of TAB_PERMISSION_ITEMS) {
                    const permission = addTabPermissions[key];
                    await upsertTabPermission({
                        user_id: selectedPerson.system_id,
                        tab_key: key,
                        can_read: permission.can_read,
                        can_write: permission.can_read ? permission.can_write : false,
                    });
                }
            } catch (permErr) {
                // Non-critical: user was added, permissions can be set later
                console.warn('Failed to init tab permissions:', permErr);
            }

            showToast("User added successfully", "success");
            closeAddModal();
        } catch (err: any) {
            showToast(err.message || "Failed to add user", "error");
        }
    };

    const closeAddModal = () => {
        setShowAddModal(false);
        setSelectedPerson(null);
        setSelectedSecurityLevel(null);
        setSelectedLang("en");
        setSelectedTheme("light");
        setSelectedAllowLargeDownloads(false);
        setAddTabPermissions(createDefaultAddTabPermissions());
        setSearchQuery("");
        // searchResults is derived from query, so clearing query clears results
    };

    const openEditModal = (user: EdmsUser) => {
        setEditTarget(user);
        setEditSecurityLevel(user.security_level_id);
        setEditLang(user.lang);
        setEditTheme(user.theme);
        setEditQuota(user.remaining_quota);
        setEditTotalQuota(user.quota);
        setEditAllowLargeDownloads(user.allow_large_downloads);
    };

    const closeEditModal = () => {
        setEditTarget(null);
        setEditSecurityLevel(null);
        setEditLang("en");
        setEditTheme("light");
        setEditQuota(null);
        setEditTotalQuota(null);
        setEditAllowLargeDownloads(false);
    };

    useEffect(() => {
        if (!editTarget) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setEditTarget(null);
                setEditSecurityLevel(null);
                setEditTheme("light");
                setEditQuota(null);
                setEditTotalQuota(null);
                setEditAllowLargeDownloads(false);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [editTarget]);

    const handleEditUser = async () => {
        if (!editTarget || !editSecurityLevel) {
            showToast("Please select a security level", "error");
            return;
        }

        try {
            await updateUser({
                edms_user_id: editTarget.edms_user_id,
                security_level_id: editSecurityLevel,
                lang: editLang,
                theme: editTheme,
                remaining_quota: editQuota,
                quota: editTotalQuota,
                allow_large_downloads: editAllowLargeDownloads,
            });

            showToast("User updated successfully", "success");
            closeEditModal();
        } catch (err: any) {
            showToast(err.message || "Failed to update user", "error");
        }
    };

    const handleDeleteUser = async () => {
        if (!deleteTarget) return;

        try {
            await deleteUser(deleteTarget.edms_user_id);

            showToast("User deleted successfully", "success");
            setDeleteTarget(null);
        } catch (err: any) {
            showToast(err.message || "Failed to delete user", "error");
        }
    };

    const handleRetryFailedQueue = async () => {
        try {
            const result = await retryFailedQueue(100);
            showToast(`Requeued ${result?.requeued ?? 0} failed jobs`, "success");
            await refetchQueueStatus();
        } catch (err: any) {
            showToast(err.message || "Failed to retry queue jobs", "error");
        }
    };

    const handleClearCompletedQueue = async () => {
        try {
            const result = await clearCompletedQueue(24);
            showToast(`Cleared ${result?.deleted ?? 0} completed jobs`, "success");
            await refetchQueueStatus();
        } catch (err: any) {
            showToast(err.message || "Failed to clear completed queue jobs", "error");
        }
    };

    const handleRetrySingleDoc = async (docnumber: number) => {
        setRetryingDocnumber(docnumber);
        try {
            const result = await retrySelectedQueue([docnumber]);
            showToast(`Requeued ${result?.requeued ?? 0} job for doc ${docnumber}`, "success");
            await refetchQueueStatus();
        } catch (err: any) {
            showToast(err.message || `Failed to retry doc ${docnumber}`, "error");
        } finally {
            setRetryingDocnumber(null);
        }
    };

    const toggleErrorExpanded = (docnumber: number) => {
        setExpandedErrorRows((prev) => ({
            ...prev,
            [docnumber]: !prev[docnumber],
        }));
    };

    const handleCopyError = async (docnumber: number, errorText: string) => {
        const text = errorText || 'Unknown error';
        try {
            await navigator.clipboard.writeText(text);
            showToast(`Error copied for doc ${docnumber}`, 'success');
        } catch {
            showToast('Failed to copy error text', 'error');
        }
    };

    const handleManualQueueRefresh = async () => {
        await refetchQueueStatus();
    };



    const displayedQueueRows = queueViewFilter === 'failed'
        ? (queueStatus?.recent_failures || [])
        : queueViewFilter === 'in_progress'
            ? (queueStatus?.recent_in_progress || [])
            : (queueStatus?.recent_queued || []);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    if (isLoading) {
        return (
            <PageSpinner />
        );
    }

    if (!hasAccess) return null;

    return (
        <div className="p-6">
            <div className="max-w-6xl mx-auto">
                <div className="mb-4 flex items-center gap-2">
                    <button
                        onClick={() => setActiveAdminTab('users')}
                        className={`px-3 py-2 rounded-md text-sm font-medium ${activeAdminTab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                    >
                        {t('adminUsers') || 'Users'}
                    </button>
                    <button
                        onClick={() => setActiveAdminTab('worker')}
                        className={`px-3 py-2 rounded-md text-sm font-medium ${activeAdminTab === 'worker' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                    >
                        {t('worker') || 'Worker'}
                    </button>
                </div>


                {/* Processing Queue Status — Read-Only Monitoring */}
                {activeAdminTab === 'worker' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Processing Queue</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleManualQueueRefresh}
                                disabled={isQueueFetching}
                                className="px-3 py-1.5 rounded-md text-xs font-medium bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isQueueFetching ? 'Refreshing...' : 'Refresh'}
                            </button>
                            <button
                                onClick={handleRetryFailedQueue}
                                disabled={isRetryingFailedQueue || (queueStatus?.summary?.failed ?? 0) === 0}
                                className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isRetryingFailedQueue ? 'Retrying...' : 'Retry Failed'}
                            </button>
                            <button
                                onClick={handleClearCompletedQueue}
                                disabled={isClearingCompletedQueue || (queueStatus?.summary?.completed ?? 0) === 0}
                                className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isClearingCompletedQueue ? 'Clearing...' : 'Clear Completed (>24h)'}
                            </button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {isQueueLoading ? 'Loading...' : 'Auto-refresh every 8s'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Queued</div>
                            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{queueStatus?.summary?.queued ?? 0}</div>
                        </div>
                        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400">In Progress</div>
                            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{queueStatus?.summary?.in_progress ?? 0}</div>
                        </div>
                        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
                            <div className="text-xl font-bold text-green-600 dark:text-green-400">{queueStatus?.summary?.completed ?? 0}</div>
                        </div>
                        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
                            <div className="text-xl font-bold text-red-600 dark:text-red-400">{queueStatus?.summary?.failed ?? 0}</div>
                        </div>
                        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                            <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{queueStatus?.summary?.total ?? 0}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
                            <div className="text-xs text-gray-500 dark:text-gray-400">Oracle TAGGING_QUEUE Candidates</div>
                            <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{queueStatus?.oracle_queued_count ?? queueStatus?.source_counts?.oracle_queued ?? 0}</div>
                        </div>
                        <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-600 dark:text-gray-300">
                            <div className="font-medium mb-1">Row Source</div>
                            <div>Failed / In Progress lists are from local worker queue (SQLite).</div>
                            <div>TAGGING_QUEUE list is from Oracle pending candidates.</div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {queueViewFilter === 'failed'
                                    ? 'Recent Failures (Local Queue)'
                                    : queueViewFilter === 'in_progress'
                                        ? 'Recent In Progress (Local Queue)'
                                        : 'Queued in TAGGING_QUEUE'}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setQueueViewFilter('failed')}
                                    className={`px-2 py-1 rounded text-xs font-medium ${queueViewFilter === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                                >
                                    Show Failed ({queueStatus?.source_counts?.local_failed ?? queueStatus?.summary?.failed ?? 0})
                                </button>
                                <button
                                    onClick={() => setQueueViewFilter('in_progress')}
                                    className={`px-2 py-1 rounded text-xs font-medium ${queueViewFilter === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                                >
                                    Show In Progress ({queueStatus?.source_counts?.local_in_progress ?? queueStatus?.summary?.in_progress ?? 0})
                                </button>
                                <button
                                    onClick={() => setQueueViewFilter('queued')}
                                    className={`px-2 py-1 rounded text-xs font-medium ${queueViewFilter === 'queued' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                                >
                                    Show TAGGING_QUEUE ({queueStatus?.oracle_queued_count ?? queueStatus?.source_counts?.oracle_queued ?? 0})
                                </button>
                            </div>
                        </div>
                        {displayedQueueRows.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {queueViewFilter === 'failed'
                                    ? 'No recent failures.'
                                    : queueViewFilter === 'in_progress'
                                        ? 'No in-progress jobs.'
                                        : 'No queued TAGGING_QUEUE candidates returned.'}
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 dark:text-gray-400">
                                            <th className="py-2 pr-4">Doc</th>
                                            <th className="py-2 pr-4">Attempts</th>
                                            <th className="py-2 pr-4">Updated</th>
                                            <th className="py-2">Error</th>
                                            <th className="py-2 pl-4">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedQueueRows.map((f) => (
                                            <tr key={`${f.docnumber}-${f.updated_at}`} className="border-t border-gray-100 dark:border-gray-700">
                                                <td className="py-2 pr-4 font-mono">{f.docnumber}</td>
                                                <td className="py-2 pr-4">{f.attempts}</td>
                                                <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{f.updated_at}</td>
                                                <td className="py-2 max-w-[420px]">
                                                    <div className="flex flex-col gap-1">
                                                        <div
                                                            className={`text-red-600 dark:text-red-400 ${expandedErrorRows[f.docnumber] ? 'whitespace-pre-wrap break-words' : 'truncate'}`}
                                                            title={f.error}
                                                        >
                                                            {f.error || (queueViewFilter === 'in_progress' ? 'Processing...' : queueViewFilter === 'queued' ? 'Pending in TAGGING_QUEUE' : 'Unknown error')}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => toggleErrorExpanded(f.docnumber)}
                                                                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                                            >
                                                                {expandedErrorRows[f.docnumber] ? 'Collapse' : 'Expand'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleCopyError(f.docnumber, f.error || '')}
                                                                className="text-xs text-gray-600 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                                                            >
                                                                Copy Error
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-2 pl-4">
                                                    <button
                                                        onClick={() => handleRetrySingleDoc(f.docnumber)}
                                                        disabled={queueViewFilter !== 'failed' || (isRetryingSelectedQueue && retryingDocnumber === f.docnumber)}
                                                        className="px-2 py-1 rounded text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {queueViewFilter !== 'failed'
                                                            ? 'N/A'
                                                            : (isRetryingSelectedQueue && retryingDocnumber === f.docnumber ? 'Retrying...' : 'Retry')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                )}

                {/* Users Table Card */}
                {activeAdminTab === 'users' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                    {/* Table Header with Search and Add Button */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('edmsUsers') || 'EDMS Users'}</h2>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                ({totalUsers} {t('total') || 'total'})
                            </span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            {/* Search existing users */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={userFilter}
                                    onChange={(e) => setUserFilter(e.target.value)}
                                    placeholder={t('searchUsers') || "Search users or names..."}
                                    className="w-full sm:w-64 px-3 py-2 pl-9 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                />
                                <Image src="/search-icon.svg" alt="" width={16} height={16} className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:invert" />
                                {isLoadingUsers && (
                                    <div className="absolute right-3 top-2.5">
                                        <Image src="/icons/spinner.svg" alt="" width={16} height={16} className="animate-spin h-4 w-4" />
                                    </div>
                                )}
                            </div>
                            {/* Add User Button */}
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
                            >
                                <Image src="/icons/plus.svg" alt="" width={16} height={16} className="h-4 w-4 invert" />
                                {t('addUser') || 'Add User'}
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t('username') || 'Username'}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t('fullName') || 'Full Name'}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t('securityLevel') || 'Security Level'}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t('language') || 'Language'}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t('theme') || 'Theme'}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t('quotaUsage') || 'Quota (Usage)'}
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        {t('actions') || 'Actions'}
                                    </th>
                                </tr>
                            </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {users.map((user) => (
                                <tr
                                    key={user.edms_user_id}
                                    onDoubleClick={() => openEditModal(user)}
                                    title="Double-click to edit"
                                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                        {user.username}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                        {user.full_name || user.username}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                        <div className="flex flex-col gap-1">
                                            <span className={`px-2 py-1 rounded text-xs font-medium w-fit ${user.security_level === 'Admin' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                                user.security_level === 'Editor' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                                }`}>
                                                {user.security_level}
                                            </span>
                                            {user.allow_large_downloads && (
                                                <span className="px-2 py-1 rounded text-xs font-medium w-fit bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" title="Can download folders > 1GB">
                                                    &gt;1 GB Allowed
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                        {user.lang.toUpperCase()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">
                                        {user.theme}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 font-mono">
                                        <QuotaPieChart remaining={user.remaining_quota} total={user.quota} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                        <button
                                            onClick={() => openEditModal(user)}
                                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                        >
                                            {t('edit') || 'Edit'}
                                        </button>
                                        <button
                                            onClick={() => setDeleteTarget(user)}
                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                        >
                                            {t('delete') || 'Delete'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && !isLoadingUsers && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        {userFilter ? (t('noUsersMatch') || "No users match your search") : (t('noUsersFound') || "No users found")}
                                    </td>
                                </tr>
                            )}
                            {isLoadingUsers && users.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        <Spinner size="sm" center />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                {t('showing') || 'Showing'} {((currentPage - 1) * ITEMS_PER_PAGE) + 1} {t('to') || 'to'} {Math.min(currentPage * ITEMS_PER_PAGE, totalUsers)} {t('of') || 'of'} {totalUsers}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => goToPage(1)}
                                    disabled={currentPage === 1 || isLoadingUsers}
                                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                                >
                                    {t('first') || 'First'}
                                </button>
                                <button
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1 || isLoadingUsers}
                                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                                >
                                    {t('previous') || 'Previous'}
                                </button>
                                <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                                    {t('page')} {currentPage} {t('of')} {totalPages}
                                </span>
                                <button
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={!hasMore || isLoadingUsers}
                                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                                >
                                    Next
                                </button>
                                <button
                                    onClick={() => goToPage(totalPages)}
                                    disabled={currentPage === totalPages || isLoadingUsers}
                                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                                >
                                    Last
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Add New User
                            </h3>
                            <button
                                onClick={closeAddModal}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <Image src="/icons/close.svg" alt="" width={24} height={24} className="h-6 w-6 dark:invert" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4 overflow-y-auto min-h-0">
                            {/* Person Search */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Search People (not yet in Smart EDMS)
                                </label>
                                <input
                                    type="text"
                                    value={selectedPerson ? `${selectedPerson.user_id} - ${selectedPerson.name}` : searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setSelectedPerson(null);
                                    }}
                                    placeholder="Type to search by username or name..."
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                                {isSearching && (
                                    <div className="absolute right-4 top-11 text-gray-400">
                                        <Image src="/icons/spinner.svg" alt="" width={20} height={20} className="animate-spin h-5 w-5" />
                                    </div>
                                )}
                                {searchResults.length > 0 && !selectedPerson && (
                                    <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                                        {searchResults.map((person) => (
                                            <li
                                                key={person.system_id}
                                                onClick={() => {
                                                    setSelectedPerson(person);
                                                    setSearchQuery(""); // Clear query to hide results
                                                }}
                                                className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-600 last:border-0"
                                            >
                                                <div className="font-medium">{person.user_id}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">{person.name}</div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && !selectedPerson && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 text-center text-gray-500 dark:text-gray-400">
                                        No users found matching your search
                                    </div>
                                )}
                            </div>

                            {/* Selected Person Display */}
                            {selectedPerson && (
                                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                                    <div>
                                        <div className="font-medium text-green-800 dark:text-green-200">{selectedPerson.user_id}</div>
                                        <div className="text-sm text-green-600 dark:text-green-400">{selectedPerson.name}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedPerson(null);
                                            setSearchQuery("");
                                        }}
                                        className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                                    >
                                        <Image src="/icons/close.svg" alt="" width={20} height={20} className="h-5 w-5 dark:invert" />
                                    </button>
                                </div>
                            )}

                            {/* Security Level Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Security Level
                                </label>
                                <select
                                    value={selectedSecurityLevel || ""}
                                    onChange={(e) => setSelectedSecurityLevel(Number(e.target.value))}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                >
                                    <option value="">Select security level...</option>
                                    {securityLevels.map((level) => (
                                        <option key={level.id} value={level.id}>
                                            {level.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Language and Theme Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Language
                                    </label>
                                    <select
                                        value={selectedLang}
                                        onChange={(e) => setSelectedLang(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    >
                                        {LANGUAGES.map((lang) => (
                                            <option key={lang.code} value={lang.code}>
                                                {lang.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Theme
                                    </label>
                                    <select
                                        value={selectedTheme}
                                        onChange={(e) => setSelectedTheme(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    >
                                        {THEMES.map((theme) => (
                                            <option key={theme.code} value={theme.code}>
                                                {theme.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Allow Large Downloads */}
                            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Allow Large Downloads</h4>
                                    <p className="text-xs text-gray-500 mt-1">Allows downloading folders larger than 1 GB</p>
                                </div>
                                <button
                                    onClick={() => setSelectedAllowLargeDownloads(!selectedAllowLargeDownloads)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${selectedAllowLargeDownloads ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'} cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedAllowLargeDownloads ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Tab Permissions Toggles */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Tab Permissions</h4>
                                <div className="space-y-3">
                                    {TAB_PERMISSION_ITEMS.map(({ key, label }) => {
                                        const canRead = addTabPermissions[key].can_read;
                                        const canWrite = addTabPermissions[key].can_write;

                                        return (
                                            <div key={key} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3">
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] text-gray-400 dark:text-gray-500 uppercase">Visible</span>
                                                        <button
                                                            onClick={() => setAddTabPermissions((prev) => ({
                                                                ...prev,
                                                                [key]: {
                                                                    can_read: !canRead,
                                                                    can_write: canRead ? false : canWrite,
                                                                }
                                                            }))}
                                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${canRead ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'} cursor-pointer hover:opacity-80`}
                                                        >
                                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${canRead ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] text-gray-400 dark:text-gray-500 uppercase">Editor</span>
                                                        <button
                                                            onClick={() => setAddTabPermissions((prev) => ({
                                                                ...prev,
                                                                [key]: {
                                                                    can_read: canRead,
                                                                    can_write: !canWrite,
                                                                }
                                                            }))}
                                                            disabled={!canRead}
                                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${canWrite ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'} ${!canRead ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                                                        >
                                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${canWrite ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Users in group EMS_ADMIN are automatically granted EMS Admin tab access.
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg shrink-0">
                            <button
                                onClick={closeAddModal}
                                disabled={isAddingUser}
                                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddUser}
                                disabled={!selectedPerson || !selectedSecurityLevel || isAddingUser}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                            >
                                {isAddingUser ? (
                                    <>
                                        <Image src="/icons/spinner.svg" alt="" width={16} height={16} className="animate-spin h-4 w-4 invert" />
                                        Adding...
                                    </>
                                ) : (
                                    "Add User"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editTarget && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Edit User: {editTarget.username}
                            </h3>
                            <button
                                onClick={closeEditModal}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <Image src="/icons/close.svg" alt="" width={24} height={24} className="h-6 w-6 dark:invert" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Security Level Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Security Level
                                </label>
                                <select
                                    value={editSecurityLevel || ""}
                                    onChange={(e) => setEditSecurityLevel(Number(e.target.value))}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Select security level...</option>
                                    {securityLevels.map((level) => (
                                        <option key={level.id} value={level.id}>
                                            {level.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Language and Theme Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Language
                                    </label>
                                    <select
                                        value={editLang}
                                        onChange={(e) => setEditLang(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        {LANGUAGES.map((lang) => (
                                            <option key={lang.code} value={lang.code}>
                                                {lang.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Theme
                                    </label>
                                    <select
                                        value={editTheme}
                                        onChange={(e) => setEditTheme(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        {THEMES.map((theme) => (
                                            <option key={theme.code} value={theme.code}>
                                                {theme.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Quota Edit */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Remaining Quota (bytes)
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        value={editQuota ?? ""}
                                        onChange={(e) => setEditQuota(Number(e.target.value))}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {formatQuota(editQuota || 0)}
                                    </span>
                                </div>
                            </div>

                            {/* Total Quota Edit */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Total Quota (bytes)
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        value={editTotalQuota ?? ""}
                                        onChange={(e) => setEditTotalQuota(Number(e.target.value))}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {formatQuota(editTotalQuota || 0)}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Default 1GB = 1073741824 bytes</p>

                            {/* Allow Large Downloads */}
                            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Allow Large Downloads</h4>
                                    <p className="text-xs text-gray-500 mt-1">Allows downloading folders larger than 1 GB</p>
                                </div>
                                <button
                                    onClick={() => setEditAllowLargeDownloads(!editAllowLargeDownloads)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editAllowLargeDownloads ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'} cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editAllowLargeDownloads ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Tab Permissions Toggles */}
                            {editTarget.security_level !== 'Admin' && (
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Tab Permissions</h4>
                                    <div className="space-y-3">
                                        {TAB_PERMISSION_ITEMS.map(({ key, label }) => {
                                            const perm = editUserTabPerms.find(p => p.tab_key === key);
                                            const canRead = perm?.can_read ?? (key === 'ems_admin' ? false : true);
                                            const canWrite = perm?.can_write ?? false;

                                            return (
                                                <div key={key} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-4 py-3">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                                                    <div className="flex items-center gap-4">
                                                        {/* Visible toggle */}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[11px] text-gray-400 dark:text-gray-500 uppercase">Visible</span>
                                                            <button
                                                                onClick={() => upsertTabPermission({
                                                                    user_id: editTarget.people_system_id,
                                                                    tab_key: key,
                                                                    can_read: !canRead,
                                                                    can_write: canRead ? false : canWrite,
                                                                })}
                                                                disabled={isUpsertingTabPermission}
                                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${canRead ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                                                    } cursor-pointer hover:opacity-80`}
                                                            >
                                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${canRead ? 'translate-x-4' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>
                                                        {/* Editor toggle */}
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[11px] text-gray-400 dark:text-gray-500 uppercase">Editor</span>
                                                            <button
                                                                onClick={() => upsertTabPermission({
                                                                    user_id: editTarget.people_system_id,
                                                                    tab_key: key,
                                                                    can_read: canRead,
                                                                    can_write: !canWrite,
                                                                })}
                                                                disabled={!canRead || isUpsertingTabPermission}
                                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${canWrite ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                                                                    } ${!canRead ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                                                            >
                                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${canWrite ? 'translate-x-4' : 'translate-x-0.5'
                                                                    }`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {editTarget.security_level === 'Admin' && (
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                        <Image src="/icons/info.svg" alt="" width={16} height={16} className="h-4 w-4 dark:invert" />
                                        Admin users have full access to all tabs.
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
                            <button
                                onClick={closeEditModal}
                                disabled={isUpdatingUser}
                                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditUser}
                                disabled={!editSecurityLevel || isUpdatingUser}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                            >
                                {isUpdatingUser ? (
                                    <>
                                        <Image src="/icons/spinner.svg" alt="" width={16} height={16} className="animate-spin h-4 w-4 invert" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Confirm Delete
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Are you sure you want to remove <strong>{deleteTarget.username}</strong> from EDMS access?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeletingUser}
                                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteUser}
                                disabled={isDeletingUser}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                            >
                                {isDeletingUser ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


