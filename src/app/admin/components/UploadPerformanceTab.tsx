'use client';

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
    useAdmin,
    PerformanceRow,
    PerformanceSummary,
    UploadingUser,
    UserPerformanceParams
} from '../../../hooks/useAdmin';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslations } from '../../hooks/useTranslations';
import { useToast } from '../../context/ToastContext';
import { Spinner, PageSpinner } from '../../components/Spinner';
import { generatePerformancePdfReport } from '../utils/performancePdfReport';
import { apiClient } from '../../../lib/apiClient';
import LoginLogsTab from './LoginLogsTab';

type GroupByOption = 'user' | 'month' | 'week' | 'day' | 'user_monthly';
type ScopeOption = 'media' | 'all';
type DatePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'last_7' | 'this_month' | 'last_month' | 'this_year' | 'custom';


function formatSessionDuration(loginStr: string | null | undefined, logoutStr: string | null | undefined, isActive: boolean | undefined): string {
    if (!loginStr) return '-';
    const loginTime = new Date(loginStr).getTime();
    if (isNaN(loginTime)) return '-';

    const endTime = logoutStr ? new Date(logoutStr).getTime() : (isActive ? Date.now() : null);
    if (!endTime || isNaN(endTime)) return isActive ? 'Active Now' : '-';

    const diffMs = Math.max(0, endTime - loginTime);
    const diffSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSecs / 3600);
    const minutes = Math.floor((diffSecs % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m`;
    }
    return `${diffSecs}s`;
}

export default function UploadPerformanceTab() {
    const { user } = useAuth();
    const lang = user?.lang || 'en';
    const t = useTranslations(lang as 'en' | 'ar');
    const { showToast } = useToast();

    // Queries from hook
    const {
        useUserPerformance,
        useUploadingUsers,
        useUserPerformanceDetails
    } = useAdmin();

    // -------------------------------------------------------------------------
    // Filter State
    // -------------------------------------------------------------------------
    const [datePreset, setDatePreset] = useState<DatePreset>('all');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [groupBy, setGroupBy] = useState<GroupByOption>('user');
    const [scope, setScope] = useState<ScopeOption>('media');
    const [page, setPage] = useState<number>(1);
    const [limit, setLimit] = useState<number>(20);
    const [sortBy, setSortBy] = useState<string>('uploads');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [search, setSearch] = useState<string>('');
    const [debouncedSearch, setDebouncedSearch] = useState<string>('');

    // Active Section State (Upload Performance vs Login History)
    const [performanceSection, setPerformanceSection] = useState<'uploads' | 'logins'>('uploads');

    // Drilldown modal state
    const [drilldownUser, setDrilldownUser] = useState<string | null>(null);
    const [drilldownSubtab, setDrilldownSubtab] = useState<'documents' | 'monthly' | 'logins'>('documents');
    const [drilldownDocPage, setDrilldownDocPage] = useState<number>(1);

    // Exporting states
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    // Handle Quick Date Presets
    const applyDatePreset = (preset: DatePreset) => {
        setDatePreset(preset);
        setPage(1);

        const now = new Date();
        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        if (preset === 'all') {
            setDateFrom('');
            setDateTo('');
            return;
        }

        if (preset === 'today') {
            const todayStr = formatDate(now);
            setDateFrom(todayStr);
            setDateTo(todayStr);
            return;
        }

        if (preset === 'yesterday') {
            const yest = new Date(now);
            yest.setDate(yest.getDate() - 1);
            const yestStr = formatDate(yest);
            setDateFrom(yestStr);
            setDateTo(yestStr);
            return;
        }

        if (preset === 'this_week') {
            // Monday of this week
            const dayOfWeek = now.getDay();
            const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const monday = new Date(now);
            monday.setDate(monday.getDate() - diffToMonday);
            setDateFrom(formatDate(monday));
            setDateTo(formatDate(now));
            return;
        }

        if (preset === 'last_7') {
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            setDateFrom(formatDate(sevenDaysAgo));
            setDateTo(formatDate(now));
            return;
        }

        if (preset === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            setDateFrom(formatDate(firstDay));
            setDateTo(formatDate(now));
            return;
        }

        if (preset === 'last_month') {
            const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            setDateFrom(formatDate(firstDayLastMonth));
            setDateTo(formatDate(lastDayLastMonth));
            return;
        }

        if (preset === 'this_year') {
            const firstDayYear = new Date(now.getFullYear(), 0, 1);
            setDateFrom(formatDate(firstDayYear));
            setDateTo(formatDate(now));
            return;
        }
    };

    // Construct query parameters
    const queryParams: UserPerformanceParams = useMemo(() => ({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        username: selectedUser || undefined,
        group_by: groupBy,
        scope,
        page,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder,
        search: debouncedSearch || undefined,
    }), [dateFrom, dateTo, selectedUser, groupBy, scope, page, limit, sortBy, sortOrder, debouncedSearch]);

    // Main Performance Query
    const {
        data: performanceData,
        isLoading,
        isFetching,
        refetch
    } = useUserPerformance(queryParams, true);

    // List of Uploading Users for Dropdown
    const { data: uploadingUsers = [] } = useUploadingUsers(scope, true);

    // Drilldown details query
    const {
        data: userDetailsData,
        isLoading: isLoadingDetails
    } = useUserPerformanceDetails(
        drilldownUser,
        {
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            scope,
            page: drilldownDocPage,
            limit: 15,
        },
        !!drilldownUser
    );

    const summary: PerformanceSummary = performanceData?.summary || {
        total_uploads: 0,
        total_completed: 0,
        total_pending: 0,
        overall_completion_rate: 0,
        active_users_count: 0,
        top_uploader: null,
    };

    const rows: PerformanceRow[] = performanceData?.rows || [];
    const pagination = performanceData?.pagination || { page: 1, limit: 20, total_rows: 0, total_pages: 1, has_more: false };
    const chartData = performanceData?.chart_data || [];

    // Sorting toggler
    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
        setPage(1);
    };

    // -------------------------------------------------------------------------
    // PDF Report Generator Handler
    // -------------------------------------------------------------------------
    const handleGeneratePdf = async (targetUsername?: string) => {
        setIsGeneratingPdf(true);
        showToast('Preparing PDF Report...', 'info');

        try {
            const userFilterParam = targetUsername || selectedUser;
            const searchParams = new URLSearchParams();
            if (dateFrom) searchParams.append('date_from', dateFrom);
            if (dateTo) searchParams.append('date_to', dateTo);
            if (userFilterParam) searchParams.append('username', userFilterParam);
            searchParams.append('group_by', groupBy);
            searchParams.append('scope', scope);

            // Fetch unpaginated export dataset
            const exportResponse: any = await apiClient.get(`/api/admin/user-performance/export?${searchParams.toString()}`);
            const exportRows = exportResponse.rows || [];
            const exportSummary = exportResponse.summary || summary;

            let drilldownExportDetails = undefined;
            if (userFilterParam) {
                const detailsResponse: any = await apiClient.get(
                    `/api/admin/user-performance/user/${encodeURIComponent(userFilterParam)}/details?scope=${scope}&limit=30`
                );
                drilldownExportDetails = {
                    monthlyTrend: detailsResponse?.monthly_trend,
                    recentDocs: detailsResponse?.documents,
                };
            }

            const targetUserObj = uploadingUsers.find(u => u.username === userFilterParam);

            generatePerformancePdfReport({
                summary: exportSummary,
                rows: exportRows,
                filterCriteria: {
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                    username: userFilterParam || undefined,
                    userFullName: targetUserObj?.full_name,
                    groupBy,
                    scope,
                },
                generatedBy: user?.username,
                userDetails: drilldownExportDetails,
            });

            showToast('PDF report downloaded successfully.', 'success');
        } catch (err: any) {
            console.error('Failed to generate PDF:', err);
            showToast(err.message || 'Failed to generate PDF report', 'error');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // -------------------------------------------------------------------------
    // Excel Export Handler
    // -------------------------------------------------------------------------
    const handleExportExcel = async () => {
        setIsExportingExcel(true);
        showToast('Preparing Excel export...', 'info');

        try {
            const searchParams = new URLSearchParams();
            if (dateFrom) searchParams.append('date_from', dateFrom);
            if (dateTo) searchParams.append('date_to', dateTo);
            if (selectedUser) searchParams.append('username', selectedUser);
            searchParams.append('group_by', groupBy);
            searchParams.append('scope', scope);

            const exportResponse: any = await apiClient.get(`/api/admin/user-performance/export?${searchParams.toString()}`);
            const exportRows: any[] = exportResponse.rows || [];

            if (exportRows.length === 0) {
                showToast('No records found to export.', 'error');
                setIsExportingExcel(false);
                return;
            }

            const workbook = XLSX.utils.book_new();

            // Summary Sheet
            const summarySheetData = [
                { Metric: 'Report Title', Value: 'EDMS Media - User Performance Audit' },
                { Metric: 'Scope', Value: scope === 'media' ? 'EDMS Media (Photos & Media)' : 'All System Documents' },
                { Metric: 'Date Range', Value: dateFrom || dateTo ? `${dateFrom || 'Earliest'} to ${dateTo || 'Present'}` : 'All Time' },
                { Metric: 'Target User', Value: selectedUser || 'All Users' },
                { Metric: 'Group By', Value: groupBy },
                { Metric: 'Total Uploads', Value: summary.total_uploads },
                { Metric: 'Total Completed', Value: summary.total_completed },
                { Metric: 'Total Pending', Value: summary.total_pending },
                { Metric: 'Overall Completion Rate', Value: `${summary.overall_completion_rate}%` },
                { Metric: 'Active Uploaders', Value: summary.active_users_count },
                { Metric: 'Generated At', Value: new Date().toISOString() },
                { Metric: 'Generated By', Value: user?.username || 'Admin' },
            ];
            const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
            XLSX.utils.book_append_sheet(workbook, wsSummary, 'Summary');

            // Data Sheet
            const wsData = XLSX.utils.json_to_sheet(exportRows);
            XLSX.utils.book_append_sheet(workbook, wsData, 'Performance Data');

            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `EDMS_Performance_Report_${groupBy}_${dateStr}.xlsx`;
            XLSX.writeFile(workbook, filename);

            showToast(`Exported ${exportRows.length} rows to ${filename}`, 'success');
        } catch (err: any) {
            console.error('Failed to export Excel:', err);
            showToast(err.message || 'Failed to export to Excel', 'error');
        } finally {
            setIsExportingExcel(false);
        }
    };

    // Calculate max chart value for scaling bars
    const maxChartValue = useMemo(() => {
        if (!chartData || chartData.length === 0) return 1;
        return Math.max(...chartData.map(d => Math.max(d.uploads, d.completed)), 1);
    }, [chartData]);

    return (
        <div className="space-y-6">
            {/* ----------------------------------------------------------------- */}
            {/* Header Banner & Global Actions                                    */}
            {/* ----------------------------------------------------------------- */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </span>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                {t('uploadPerformance') || 'User Upload & Completion Performance'}
                            </h1>
                            <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                                Upper Admin Only
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {t('uploadPerformanceDesc') || 'Track document and photo uploads per user, monitor completion quality, analyze trends, and export audit-ready PDF reports.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Refresh Button */}
                        <button
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            title="Refresh Data"
                        >
                            <svg className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Refresh</span>
                        </button>

                        {/* Excel Export Button */}
                        <button
                            onClick={handleExportExcel}
                            disabled={isExportingExcel || rows.length === 0}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isExportingExcel ? (
                                <Spinner size="xs" />
                            ) : (
                                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                    <path d="m9.5 13.5 1.5 2.5 1.5-2.5h1.7l-2.4 3.5 2.4 3.5h-1.7l-1.5-2.5-1.5 2.5H7.8l2.4-3.5-2.4-3.5h1.7z"/>
                                </svg>
                            )}
                            <span>{t('exportExcel') || 'Export Excel'}</span>
                        </button>

                        {/* PDF Report Button */}
                        <button
                            onClick={() => handleGeneratePdf()}
                            disabled={isGeneratingPdf || rows.length === 0}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                        >
                            {isGeneratingPdf ? (
                                <Spinner size="xs" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            )}
                            <span>{t('generatePdfReport') || 'Generate PDF Report'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* View Mode Switcher: Upload Performance vs User Login History     */}
            {/* ----------------------------------------------------------------- */}
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
                <button
                    onClick={() => setPerformanceSection('uploads')}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        performanceSection === 'uploads'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>{t('uploadAndPerformance') || 'Upload & Tagging Performance'}</span>
                </button>
                <button
                    onClick={() => setPerformanceSection('logins')}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        performanceSection === 'logins'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>{t('loginLogoutHistory') || 'User Login / Logout History'}</span>
                </button>
            </div>

            {performanceSection === 'logins' ? (
                <LoginLogsTab showTitle={false} />
            ) : (
                <>

            {/* ----------------------------------------------------------------- */}
            {/* KPI Cards Dashboard                                               */}
            {/* ----------------------------------------------------------------- */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Total Uploads */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            {t('totalUploads') || 'Total Uploads'}
                        </span>
                        <span className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-md">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                        {(summary.total_uploads || 0).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {scope === 'media' ? 'Photos & Media' : 'All Docs'}
                    </div>
                </div>

                {/* Completed Pictures */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                            {t('completedPictures') || 'Completed'}
                        </span>
                        <span className="p-1.5 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 rounded-md">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {(summary.total_completed || 0).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                        Marked as verified
                    </div>
                </div>

                {/* Pending Pictures */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">
                            {t('pendingPictures') || 'Pending'}
                        </span>
                        <span className="p-1.5 bg-amber-50 dark:bg-amber-900/40 text-amber-600 rounded-md">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {(summary.total_pending || 0).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">
                        Awaiting completion
                    </div>
                </div>

                {/* Completion Rate */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            {t('completionRate') || 'Completion Rate'}
                        </span>
                        <span className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-md">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white flex items-baseline gap-1">
                        <span>{summary.overall_completion_rate || 0}%</span>
                    </div>
                    <div className="mt-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${
                                summary.overall_completion_rate >= 80 ? 'bg-emerald-500' :
                                summary.overall_completion_rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, summary.overall_completion_rate || 0))}%` }}
                        />
                    </div>
                </div>

                {/* Active Uploaders */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            {t('activeUploaders') || 'Active Staff'}
                        </span>
                        <span className="p-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-md">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                        {summary.active_users_count || 0}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Uploaded in period
                    </div>
                </div>

                {/* Top Performer */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            {t('topUploader') || 'Top Uploader'}
                        </span>
                        <span className="p-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-500 rounded-md">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        </span>
                    </div>
                    <div className="mt-2 text-sm font-bold text-gray-900 dark:text-white truncate" title={summary.top_uploader?.full_name || summary.top_uploader?.username || 'None'}>
                        {summary.top_uploader ? (summary.top_uploader.full_name || summary.top_uploader.username) : 'N/A'}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {summary.top_uploader ? `${summary.top_uploader.total_uploads.toLocaleString()} uploads (${summary.top_uploader.completion_rate}%)` : 'No data'}
                    </div>
                </div>
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* Visual Timeline Activity Chart (Interactive Bar Chart)           */}
            {/* ----------------------------------------------------------------- */}
            {chartData && chartData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <div>
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                                Activity Trend & Daily Completion Volume
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Visual distribution of uploaded items vs. items marked completed across the period
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
                                <span className="text-gray-600 dark:text-gray-300">Total Uploaded</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                                <span className="text-gray-600 dark:text-gray-300">Completed</span>
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto pb-2">
                        <div className="flex items-end gap-2 h-40 min-w-[500px] pt-4 px-2 border-b border-gray-200 dark:border-gray-700">
                            {chartData.map((pt, i) => {
                                const uploadHeightPercent = Math.max(4, Math.round((pt.uploads / maxChartValue) * 100));
                                const completedHeightPercent = Math.max(0, Math.round((pt.completed / maxChartValue) * 100));
                                const label = pt.date.length > 5 ? pt.date.substring(5) : pt.date;

                                return (
                                    <div
                                        key={pt.date || i}
                                        className="flex-1 flex flex-col items-center justify-end h-full group relative"
                                    >
                                        {/* Hover Tooltip */}
                                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                                            <div className="bg-gray-900 text-white text-[11px] rounded-lg py-1 px-2.5 shadow-lg whitespace-nowrap">
                                                <div className="font-semibold text-center border-b border-gray-700 pb-0.5 mb-1">{pt.date}</div>
                                                <div className="flex justify-between gap-3 text-blue-300">
                                                    <span>Uploads:</span>
                                                    <span className="font-bold text-white">{pt.uploads}</span>
                                                </div>
                                                <div className="flex justify-between gap-3 text-emerald-300">
                                                    <span>Completed:</span>
                                                    <span className="font-bold text-white">{pt.completed}</span>
                                                </div>
                                                <div className="flex justify-between gap-3 text-gray-300 pt-0.5 border-t border-gray-700">
                                                    <span>Rate:</span>
                                                    <span className="font-bold text-white">
                                                        {pt.uploads > 0 ? Math.round((pt.completed * 100) / pt.uploads) : 0}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
                                        </div>

                                        {/* Dual Bars */}
                                        <div className="w-full max-w-[28px] flex items-end justify-center gap-0.5 h-full">
                                            <div
                                                className="w-1/2 bg-blue-500 hover:bg-blue-600 rounded-t transition-all"
                                                style={{ height: `${uploadHeightPercent}%` }}
                                            />
                                            <div
                                                className="w-1/2 bg-emerald-500 hover:bg-emerald-600 rounded-t transition-all"
                                                style={{ height: `${completedHeightPercent}%` }}
                                            />
                                        </div>

                                        {/* X-axis Date label (shown for reasonable density) */}
                                        {(chartData.length <= 15 || i % Math.ceil(chartData.length / 12) === 0) && (
                                            <span className="text-[10px] text-gray-400 mt-1 truncate max-w-[40px] text-center">
                                                {label}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* Filter Bar & Controls                                             */}
            {/* ----------------------------------------------------------------- */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                {/* Row 1: Quick Date Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-2 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{t('dateRange') || 'Period'}:</span>
                    </span>

                    {[
                        { id: 'all', label: t('allTime') || 'All Time' },
                        { id: 'today', label: t('today') || 'Today' },
                        { id: 'yesterday', label: t('yesterday') || 'Yesterday' },
                        { id: 'this_week', label: t('thisWeek') || 'This Week' },
                        { id: 'last_7', label: t('last7Days') || 'Last 7 Days' },
                        { id: 'this_month', label: t('thisMonth') || 'This Month' },
                        { id: 'last_month', label: t('lastMonth') || 'Last Month' },
                        { id: 'this_year', label: t('thisYear') || 'This Year' },
                    ].map(preset => (
                        <button
                            key={preset.id}
                            onClick={() => applyDatePreset(preset.id as DatePreset)}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                datePreset === preset.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                {/* Row 2: Advanced Custom Filters & Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Date From */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Date From
                        </label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                setDatePreset('custom');
                                setPage(1);
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Date To */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Date To
                        </label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                setDatePreset('custom');
                                setPage(1);
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* User Filter Dropdown */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('filterByUser') || 'Filter by User'}
                        </label>
                        <select
                            value={selectedUser}
                            onChange={(e) => {
                                setSelectedUser(e.target.value);
                                setPage(1);
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="">{t('allUsers') || 'All Uploading Users'}</option>
                            {uploadingUsers.map((u: UploadingUser) => (
                                <option key={u.username} value={u.username}>
                                    {u.full_name} ({u.username}) — {u.upload_count} uploads
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Scope Selector */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Document Scope
                        </label>
                        <select
                            value={scope}
                            onChange={(e) => {
                                setScope(e.target.value as ScopeOption);
                                setPage(1);
                            }}
                            className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="media">EDMS Media Pictures Only</option>
                            <option value="all">All System Documents</option>
                        </select>
                    </div>

                    {/* Instant Search input */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Search Staff / Period
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search username, name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Row 3: Group By View Selector Pills */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-2">
                            View Horizon:
                        </span>
                        {[
                            { id: 'user', label: t('groupByUser') || 'By User' },
                            { id: 'month', label: t('groupByMonth') || 'By Month' },
                            { id: 'week', label: t('groupByWeek') || 'By Week' },
                            { id: 'day', label: t('groupByDay') || 'By Day' },
                            { id: 'user_monthly', label: t('groupByUserMonthly') || 'User & Month' },
                        ].map(gb => (
                            <button
                                key={gb.id}
                                onClick={() => {
                                    setGroupBy(gb.id as GroupByOption);
                                    setPage(1);
                                }}
                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                    groupBy === gb.id
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                                {gb.label}
                            </button>
                        ))}
                    </div>

                    {/* Rows per page */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Rows per page:</span>
                        <select
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                            className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* Performance Data Table                                            */}
            {/* ----------------------------------------------------------------- */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider font-semibold border-b border-gray-200 dark:border-gray-700">
                                <th className="px-4 py-3.5 w-12 text-center">#</th>

                                {['month', 'week', 'day'].includes(groupBy) ? (
                                    <th
                                        onClick={() => handleSort('period')}
                                        className="px-4 py-3.5 cursor-pointer hover:text-blue-600"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Period</span>
                                            {sortBy === 'period' && (
                                                <span>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                                            )}
                                        </div>
                                    </th>
                                ) : (
                                    <>
                                        <th
                                            onClick={() => handleSort('username')}
                                            className="px-4 py-3.5 cursor-pointer hover:text-blue-600"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Staff Member / Uploader</span>
                                                {sortBy === 'username' && (
                                                    <span>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                                                )}
                                            </div>
                                        </th>
                                        {groupBy === 'user_monthly' && (
                                            <th className="px-4 py-3.5">Month</th>
                                        )}
                                    </>
                                )}

                                <th
                                    onClick={() => handleSort('uploads')}
                                    className="px-4 py-3.5 cursor-pointer hover:text-blue-600 text-right"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        <span>Total Uploads</span>
                                        {sortBy === 'uploads' && (
                                            <span>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                                        )}
                                    </div>
                                </th>

                                <th
                                    onClick={() => handleSort('completed')}
                                    className="px-4 py-3.5 cursor-pointer hover:text-blue-600 text-right"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        <span>Completed</span>
                                        {sortBy === 'completed' && (
                                            <span>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                                        )}
                                    </div>
                                </th>

                                <th
                                    onClick={() => handleSort('pending')}
                                    className="px-4 py-3.5 cursor-pointer hover:text-blue-600 text-right"
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        <span>Pending</span>
                                        {sortBy === 'pending' && (
                                            <span>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                                        )}
                                    </div>
                                </th>

                                <th
                                    onClick={() => handleSort('rate')}
                                    className="px-4 py-3.5 cursor-pointer hover:text-blue-600 w-44"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Completion Rate</span>
                                        {sortBy === 'rate' && (
                                            <span>{sortOrder === 'desc' ? '▼' : '▲'}</span>
                                        )}
                                    </div>
                                </th>

                                {['month', 'week', 'day'].includes(groupBy) ? (
                                    <th className="px-4 py-3.5 text-center">Active Staff</th>
                                ) : (
                                    <>
                                        <th className="px-4 py-3.5 text-center">Login Status</th>
                                        <th className="px-4 py-3.5 text-center">First Activity</th>
                                        <th className="px-4 py-3.5 text-center">Last Activity</th>
                                    </>
                                )}

                                <th className="px-4 py-3.5 text-center w-28">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center">
                                        <Spinner size="md" center />
                                        <p className="mt-2 text-xs text-gray-500">Loading performance data...</p>
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-gray-500 dark:text-gray-400">
                                        <div className="max-w-xs mx-auto">
                                            <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                            </svg>
                                            <p className="text-sm font-medium">
                                                {t('noPerformanceData') || 'No upload records match your current filters.'}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Try selecting &quot;All Time&quot; or broadening your date and user filters.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, idx) => {
                                    const rowNumber = (pagination.page - 1) * pagination.limit + idx + 1;
                                    const rateColor =
                                        row.completion_rate >= 80
                                            ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300'
                                            : row.completion_rate >= 50
                                            ? 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300'
                                            : 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300';

                                    const progressColor =
                                        row.completion_rate >= 80 ? 'bg-emerald-500' :
                                        row.completion_rate >= 50 ? 'bg-amber-500' : 'bg-rose-500';

                                    return (
                                        <tr
                                            key={`${row.username || ''}_${row.period || ''}_${idx}`}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                                        >
                                            <td className="px-4 py-3 text-center text-xs text-gray-400">
                                                {rowNumber}
                                            </td>

                                            {/* Entity / Period */}
                                            {['month', 'week', 'day'].includes(groupBy) ? (
                                                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                                                    <div className="flex items-center gap-2">
                                                        <span className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                        </span>
                                                        <span>{row.period}</span>
                                                    </div>
                                                </td>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
                                                                {(row.full_name || row.username || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-gray-900 dark:text-white">
                                                                    {row.full_name || row.username}
                                                                </div>
                                                                <div className="text-xs text-gray-400">
                                                                    @{row.username}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {groupBy === 'user_monthly' && (
                                                        <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                                                            {row.period}
                                                        </td>
                                                    )}
                                                </>
                                            )}

                                            {/* Total Uploads */}
                                            <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                                                <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                                                    {(row.total_uploads || 0).toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Completed */}
                                            <td className="px-4 py-3 text-right">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                    {(row.completed_count || 0).toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Pending */}
                                            <td className="px-4 py-3 text-right">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                                    {(row.pending_count || 0).toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Completion Rate with Progress Bar */}
                                            <td className="px-4 py-3">
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-xs font-semibold">
                                                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${rateColor}`}>
                                                            {row.completion_rate || 0}%
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">
                                                            {row.completed_count}/{row.total_uploads}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${progressColor}`}
                                                            style={{ width: `${Math.min(100, Math.max(0, row.completion_rate || 0))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Active users or dates */}
                                            {['month', 'week', 'day'].includes(groupBy) ? (
                                                <td className="px-4 py-3 text-center text-xs text-gray-700 dark:text-gray-300 font-medium">
                                                    {(row.active_users_count || 0).toLocaleString()} users
                                                </td>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                                                        {row.first_upload ? row.first_upload.split('T')[0] : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                                                        {row.last_upload ? row.last_upload.split('T')[0] : '—'}
                                                    </td>
                                                </>
                                            )}

                                            {/* Actions */}
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {row.username && (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    setDrilldownUser(row.username || null);
                                                                    setDrilldownDocPage(1);
                                                                }}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                                title="View User Drilldown & Uploads"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                            </button>

                                                            <button
                                                                onClick={() => handleGeneratePdf(row.username)}
                                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                                title="Download PDF for this user"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* Pager / Pagination Controls                                   */}
                {/* ------------------------------------------------------------- */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Showing{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {pagination.total_rows === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {Math.min(pagination.total_rows, pagination.page * pagination.limit)}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {pagination.total_rows}
                        </span>{' '}
                        entries
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setPage(1)}
                            disabled={page <= 1}
                            className="px-2.5 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            First
                        </button>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-2.5 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            Previous
                        </button>

                        <span className="px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                            Page {page} of {pagination.total_pages || 1}
                        </span>

                        <button
                            onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                            disabled={!pagination.has_more || page >= pagination.total_pages}
                            className="px-2.5 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            Next
                        </button>
                        <button
                            onClick={() => setPage(pagination.total_pages)}
                            disabled={page >= pagination.total_pages}
                            className="px-2.5 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                            Last
                        </button>
                    </div>
                </div>
            </div>

                </>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* User Drill-down Modal                                             */}
            {/* ----------------------------------------------------------------- */}
            {drilldownUser && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/40">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                                    {(userDetailsData?.user_info?.full_name || drilldownUser).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            {userDetailsData?.user_info?.full_name || drilldownUser}
                                        </h3>
                                        {userDetailsData?.user_info?.is_logged_in ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                Active Now
                                            </span>
                                        ) : userDetailsData?.user_info?.last_login ? (
                                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                Last login: {userDetailsData.user_info.last_login}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        @{drilldownUser} • Upload Activity, Quality & Login History
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleGeneratePdf(drilldownUser)}
                                    disabled={isGeneratingPdf}
                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>Download User PDF</span>
                                </button>
                                <button
                                    onClick={() => setDrilldownUser(null)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {isLoadingDetails ? (
                                <div className="py-12 text-center">
                                    <Spinner size="md" center />
                                    <p className="mt-2 text-xs text-gray-500">Loading user activity details...</p>
                                </div>
                            ) : (
                                <>
                                    {/* User Summary Stats */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-200 dark:border-gray-700">
                                            <span className="text-xs text-gray-500 uppercase font-semibold">Total Uploads</span>
                                            <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                                                {(userDetailsData?.user_info?.total_uploads || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                            <span className="text-xs text-emerald-600 uppercase font-semibold">Completed</span>
                                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                                {(userDetailsData?.user_info?.completed_count || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-800">
                                            <span className="text-xs text-amber-600 uppercase font-semibold">Pending</span>
                                            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                                                {(userDetailsData?.user_info?.pending_count || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-800">
                                            <span className="text-xs text-blue-600 uppercase font-semibold">Completion Rate</span>
                                            <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                                                {userDetailsData?.user_info?.completion_rate || 0}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Modal Subtabs Switcher */}
                                    <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                                        <button
                                            onClick={() => setDrilldownSubtab('documents')}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                                drilldownSubtab === 'documents'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            Uploaded Documents ({userDetailsData?.pagination.total_documents || 0})
                                        </button>
                                        <button
                                            onClick={() => setDrilldownSubtab('monthly')}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                                drilldownSubtab === 'monthly'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            Monthly Trend ({userDetailsData?.monthly_trend?.length || 0})
                                        </button>
                                        <button
                                            onClick={() => setDrilldownSubtab('logins')}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                                drilldownSubtab === 'logins'
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            Login & Session History ({userDetailsData?.recent_logins?.length || 0})
                                        </button>
                                    </div>

                                    {/* Subtab 1: Monthly Trend Breakdown */}
                                    {drilldownSubtab === 'monthly' && (
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                                                Monthly Performance Breakdown
                                            </h4>
                                            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700">
                                                        <tr>
                                                            <th className="px-3 py-2">Month</th>
                                                            <th className="px-3 py-2 text-right">Uploads</th>
                                                            <th className="px-3 py-2 text-right">Completed</th>
                                                            <th className="px-3 py-2 text-right">Pending</th>
                                                            <th className="px-3 py-2 text-right">Completion Rate</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                        {userDetailsData?.monthly_trend?.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={5} className="py-6 text-center text-gray-400">
                                                                    No monthly trend data available.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            userDetailsData?.monthly_trend?.map((m) => (
                                                                <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{m.month}</td>
                                                                    <td className="px-3 py-2 text-right">{m.total_uploads.toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right text-emerald-600 font-medium">{m.completed_count.toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right text-amber-600">{m.pending_count.toLocaleString()}</td>
                                                                    <td className="px-3 py-2 text-right font-bold text-blue-600">{m.completion_rate}%</td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Subtab 2: Paginated Documents Uploaded */}
                                    {drilldownSubtab === 'documents' && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                                    Uploaded Documents List ({userDetailsData?.pagination.total_documents || 0})
                                                </h4>
                                            </div>

                                            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700">
                                                        <tr>
                                                            <th className="px-3 py-2">Doc #</th>
                                                            <th className="px-3 py-2">Document Name / Abstract</th>
                                                            <th className="px-3 py-2 text-center">Upload Date</th>
                                                            <th className="px-3 py-2 text-center">Photo Date</th>
                                                            <th className="px-3 py-2 text-center">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                        {userDetailsData?.documents?.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={5} className="py-6 text-center text-gray-400">
                                                                    No documents found for this user in the selected range.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            userDetailsData?.documents?.map((doc) => (
                                                                <tr key={doc.docnumber} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                                    <td className="px-3 py-2 font-mono font-semibold text-blue-600 dark:text-blue-400">
                                                                        #{doc.docnumber}
                                                                    </td>
                                                                    <td className="px-3 py-2 max-w-xs truncate text-gray-900 dark:text-white" title={doc.docname || doc.abstract}>
                                                                        {doc.docname || doc.abstract || `Doc #${doc.docnumber}`}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center text-gray-500">
                                                                        {doc.creation_date}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center text-gray-500">
                                                                        {doc.doc_date}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                                            doc.is_completed
                                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                                                        }`}>
                                                                            {doc.is_completed ? 'Completed' : 'Pending'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Modal Document Pager */}
                                            {userDetailsData && userDetailsData.pagination.total_pages > 1 && (
                                                <div className="flex items-center justify-between pt-3 text-xs">
                                                    <span className="text-gray-500">
                                                        Page {drilldownDocPage} of {userDetailsData.pagination.total_pages}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setDrilldownDocPage(p => Math.max(1, p - 1))}
                                                            disabled={drilldownDocPage <= 1}
                                                            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
                                                        >
                                                            Previous
                                                        </button>
                                                        <button
                                                            onClick={() => setDrilldownDocPage(p => Math.min(userDetailsData.pagination.total_pages, p + 1))}
                                                            disabled={drilldownDocPage >= userDetailsData.pagination.total_pages}
                                                            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Subtab 3: Login & Session History for this user */}
                                    {drilldownSubtab === 'logins' && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                                    Recent Logins & Session History ({userDetailsData?.recent_logins?.length || 0})
                                                </h4>
                                            </div>

                                            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700">
                                                        <tr>
                                                            <th className="px-3 py-2 text-center">Status</th>
                                                            <th className="px-3 py-2">App Source</th>
                                                            <th className="px-3 py-2">IP Address</th>
                                                            <th className="px-3 py-2">Login Time</th>
                                                            <th className="px-3 py-2">Logout Time</th>
                                                            <th className="px-3 py-2 text-right">Duration</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                        {userDetailsData?.recent_logins?.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={6} className="py-6 text-center text-gray-400">
                                                                    No login session history recorded for this user.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            userDetailsData?.recent_logins?.map((l) => {
                                                                const isCurrentlyActive = l.is_active && !l.logout_date;
                                                                const dur = formatSessionDuration(l.login_date, l.logout_date, l.is_active);
                                                                return (
                                                                    <tr key={l.system_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                                        <td className="px-3 py-2 text-center whitespace-nowrap">
                                                                            {isCurrentlyActive ? (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                                    Active Now
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                                                    Logged Out
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-2 font-medium">{l.app_source || 'EDMS'}</td>
                                                                        <td className="px-3 py-2 font-mono text-gray-500">{l.ip_address || '-'}</td>
                                                                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{l.login_date || '-'}</td>
                                                                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                                                                            {isCurrentlyActive ? (
                                                                                <span className="text-emerald-600 font-medium">Session in progress</span>
                                                                            ) : (
                                                                                l.logout_date || '-'
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right font-medium">{dur}</td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 flex justify-end">
                            <button
                                onClick={() => setDrilldownUser(null)}
                                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
