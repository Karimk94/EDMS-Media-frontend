"use client";

import React from 'react';

interface SidebarSkeletonProps {
  isSidebarOpen: boolean;
}

/**
 * Skeleton loading state for the Sidebar component.
 * Shown while user authentication data is loading.
 */
export const SidebarSkeleton: React.FC<SidebarSkeletonProps> = ({ isSidebarOpen }) => {
  const sidebarWidth = isSidebarOpen ? 'w-60' : 'w-20';
  const padding = isSidebarOpen ? 'p-4' : 'p-3';

  const SkeletonNavItem = () => (
    <div className={`flex items-center w-full p-3 rounded-lg ${!isSidebarOpen ? 'justify-center' : 'gap-4'}`}>
      {/* Icon skeleton */}
      <div className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
      {/* Label skeleton */}
      {isSidebarOpen && (
        <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse flex-grow" style={{ maxWidth: '120px' }} />
      )}
    </div>
  );

  return (
    <aside
      className={`flex-shrink-0 bg-[var(--color-bg-sidebar)] ${sidebarWidth} ${padding} transition-all duration-300 ease-in-out flex flex-col border-r border-[var(--color-border-primary)]`}
    >
      <nav className="flex-1 space-y-2">
        <SkeletonNavItem />
        <SkeletonNavItem />
        <SkeletonNavItem />
        <SkeletonNavItem />
      </nav>

      {/* Admin section skeleton */}
      <div className="border-t border-[var(--color-border-primary)] pt-2 space-y-2">
        <SkeletonNavItem />
        <SkeletonNavItem />
      </div>
    </aside>
  );
};
