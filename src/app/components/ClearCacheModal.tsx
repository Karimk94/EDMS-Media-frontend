"use client";

import Image from 'next/image';

interface ClearCacheModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

/**
 * Confirmation dialog for clearing the thumbnail cache.
 */
export function ClearCacheModal({ isOpen, onClose, onConfirm }: ClearCacheModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Clear cache confirmation">
            <div className="bg-white dark:bg-[#333] rounded-lg p-6 max-w-sm w-full shadow-xl border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-3 mb-4 text-amber-500">
                    <Image src="/icons/warning.svg" alt="" width={32} height={32} className="dark:invert" />
                    <h3 className="text-lg font-bold dark:text-white">Clear Cache</h3>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">
                    Are you sure you want to clear the thumbnail cache? This may affect loading performance temporarily.
                </p>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors shadow-sm"
                    >
                        Yes, Clear Cache
                    </button>
                </div>
            </div>
        </div>
    );
}
