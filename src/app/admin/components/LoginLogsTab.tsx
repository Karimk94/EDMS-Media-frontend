"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useAdmin, LoginLogEntry } from "../../../hooks/useAdmin";
import { useAuth } from "../../../hooks/useAuth";
import { useTranslations } from "../../hooks/useTranslations";
import { Spinner } from "../../components/Spinner";

const ITEMS_PER_PAGE = 20;

// Simple debounce hook to avoid excessive API calls while typing
function useDebounce(value: string, delay: number = 300): string {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}

function formatDate(value: string | null): string {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString();
}

function SecurityLevelBadge({ level }: { level: string | null }) {
    const normalized = (level || "Viewer").toLowerCase();

    let classes =
        "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    if (normalized === "admin") {
        classes = "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    } else if (normalized === "editor") {
        classes = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }

    return (
        <span className={`px-2 py-1 rounded text-xs font-medium w-fit ${classes}`}>
            {level || "Viewer"}
        </span>
    );
}

interface LoginLogsTabProps {
    showTitle?: boolean;
}

export default function LoginLogsTab({ showTitle = true }: LoginLogsTabProps = {}) {
    const { user } = useAuth();
    const lang = user?.lang || "en";
    const t = useTranslations(lang as "en" | "ar");

    const { useLoginHistory } = useAdmin();

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search);

    // Reset to page 1 whenever the search changes
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    const { data, isLoading } = useLoginHistory(page, debouncedSearch);

    const logs: LoginLogEntry[] = data?.logs || [];
    const total = data?.total || 0;
    const hasMore = data?.has_more || false;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    const goToPage = (nextPage: number) => {
        if (nextPage >= 1 && nextPage <= totalPages) {
            setPage(nextPage);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {/* Header with Search */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {showTitle ? (
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {t("loginHistory") || "Login History"}
                        </h2>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({total} {t("total") || "total"})
                        </span>
                    </div>
                ) : <div />}
                <div className="relative">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("searchLoginLogs") || "Search username, name, security level or app source..."}
                        className="w-full sm:w-80 px-3 py-2 pl-9 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                    <Image
                        src="/search-icon.svg"
                        alt=""
                        width={16}
                        height={16}
                        className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:invert"
                    />
                    {isLoading && (
                        <div className="absolute right-3 top-2.5">
                            <Spinner size="xs" />
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("username") || "Username"}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("fullName") || "Full Name"}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("securityLevel") || "Security Level"}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("appSource") || "App Source"}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("ipAddress") || "IP Address"}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("loginDate") || "Login Date"}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {t("logoutDate") || "Logout Date"}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {logs.map((log) => (
                            <tr key={log.system_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {log.username}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {log.full_name || log.username}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    <SecurityLevelBadge level={log.security_level} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {log.app_source || "-"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 font-mono">
                                    {log.ip_address || "-"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {formatDate(log.login_date)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                    {formatDate(log.logout_date)}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && !isLoading && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                                >
                                    {search
                                        ? t("noLoginLogsMatch") || "No login logs match your search"
                                        : t("noLoginLogsFound") || "No login logs found"}
                                </td>
                            </tr>
                        )}
                        {isLoading && logs.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                                >
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
                        {t("showing") || "Showing"}{" "}
                        {((page - 1) * ITEMS_PER_PAGE) + 1}{" "}
                        {t("to") || "to"}{" "}
                        {Math.min(page * ITEMS_PER_PAGE, total)}{" "}
                        {t("of") || "of"} {total}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => goToPage(1)}
                            disabled={page === 1 || isLoading}
                            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                        >
                            {t("first") || "First"}
                        </button>
                        <button
                            onClick={() => goToPage(page - 1)}
                            disabled={page === 1 || isLoading}
                            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                        >
                            {t("previous") || "Previous"}
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                            {t("page") || "Page"} {page} {t("of") || "of"} {totalPages}
                        </span>
                        <button
                            onClick={() => goToPage(page + 1)}
                            disabled={!hasMore || isLoading}
                            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                        >
                            Next
                        </button>
                        <button
                            onClick={() => goToPage(totalPages)}
                            disabled={page === totalPages || isLoading}
                            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                        >
                            Last
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

