import React from 'react';

/**
 * Skeleton placeholder for folder cards - matches the grid layout in Folders.tsx.
 * Shows 3 "quick access" skeletons + 6 folder card skeletons by default.
 */
export function FolderSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="flex flex-col gap-8 animate-pulse" role="status" aria-label="Loading folders">
            {/* Quick Access skeleton (3 cards) */}
            <div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-24 mb-3 mx-1"></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center p-4 rounded-xl bg-gray-100 dark:bg-[#222]">
                            <div className="flex-shrink-0 w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                            <div className="ml-4 flex-1">
                                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20 mb-2"></div>
                                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-14"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Folder grid skeleton */}
            <div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-20 mb-3 mx-1"></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                    {Array.from({ length: count }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center p-4 rounded-xl bg-gray-100 dark:bg-[#222]">
                            <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-lg mb-3"></div>
                            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-1"></div>
                            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-10"></div>
                        </div>
                    ))}
                </div>
            </div>
            <span className="sr-only">Loading folders...</span>
        </div>
    );
}
