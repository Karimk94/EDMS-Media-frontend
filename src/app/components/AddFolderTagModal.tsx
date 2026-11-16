import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAddFolderTagMutation } from '../../hooks/useFolderMutations';
import { useTags } from '../../hooks/useTags';
import { useToast } from '../context/ToastContext';
import { LoadingButton } from './LoadingButton';
import { AddFolderTagModalProps } from '../../interfaces/PropsInterfaces';

export const AddFolderTagModal: React.FC<AddFolderTagModalProps> = ({
    folder,
    onClose,
    apiURL,
    lang = 'en',
    t,
    onTagAdded,
}) => {
    const [tagName, setTagName] = useState('');
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLUListElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const { showToast } = useToast();
    const addFolderTagMutation = useAddFolderTagMutation();
    const { allTags } = useTags({ lang });

    // Close on Escape or click outside
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isSuggestionsOpen) {
                    setIsSuggestionsOpen(false);
                } else {
                    onClose();
                }
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsSuggestionsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose, isSuggestionsOpen]);

    // Filter suggestions based on input
    const filteredSuggestions = React.useMemo(() => {
        const term = tagName.trim().toLowerCase();
        if (!term) {
            return (allTags || []).slice(0, 8);
        }
        return (allTags || [])
            .filter((tag) => tag.toLowerCase().includes(term))
            .slice(0, 10);
    }, [allTags, tagName]);

    const handleSelectSuggestion = (suggestion: string) => {
        setTagName(suggestion);
        setIsSuggestionsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isSuggestionsOpen || filteredSuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            handleSelectSuggestion(filteredSuggestions[highlightedIndex]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanTag = tagName.trim();
        if (!cleanTag) return;

        if (cleanTag.length < 2) {
            showToast(t('tagTooShort') || 'Tag must be at least 2 characters long', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const res: any = await addFolderTagMutation.mutateAsync({
                folderId: folder.id,
                tag: cleanTag,
                apiURL,
                lang,
            });

            const countMsg = res?.count !== undefined && res.count > 0
                ? (t('tagAddedToFolderCount') || 'Tag added to {{count}} file(s).').replace('{{count}}', String(res.count))
                : (res?.message || t('tagAddedToFolderSuccess') || 'Tag added to folder contents successfully.');

            showToast(countMsg, 'success');
            if (onTagAdded) onTagAdded();
            onClose();
        } catch (err: any) {
            console.error('Failed to add tag to folder contents:', err);
            const errMsg = err?.data?.detail || err?.message || t('errorAddingTag') || 'Failed to add tag to folder contents';
            showToast(errMsg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-folder-tag-title"
        >
            <div
                ref={wrapperRef}
                className="bg-white dark:bg-[#282828] rounded-xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700"
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                <line x1="7" y1="7" x2="7.01" y2="7" />
                            </svg>
                        </div>
                        <h2 id="add-folder-tag-title" className="text-lg font-bold text-gray-900 dark:text-white">
                            {t('tagFolderTitle') || 'Tag Folder Contents'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg transition"
                        aria-label={t('close') || 'Close'}
                    >
                        <Image src="/icons/close.svg" alt="" width={18} height={18} className="dark:invert opacity-70 hover:opacity-100" />
                    </button>
                </div>

                {/* Target folder & Notice */}
                <div className="space-y-3 mb-5">
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500 flex-shrink-0">
                            <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
                        </svg>
                        <span className="font-semibold truncate" title={folder.name}>
                            {folder.name}
                        </span>
                    </div>

                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-300 text-xs leading-relaxed">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span>
                            {t('addTagToFolderNotice') || 'This tag will be added to all files in this folder. Subfolders are skipped.'}
                        </span>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {t('tag') || 'Tag'}
                        </label>
                        <div className="relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={tagName}
                                onChange={(e) => {
                                    setTagName(e.target.value);
                                    setIsSuggestionsOpen(true);
                                }}
                                onFocus={() => setIsSuggestionsOpen(true)}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg p-2.5 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm"
                                placeholder={t('enterTagName') || 'Enter or search for a tag...'}
                                autoFocus
                                required
                            />
                            {tagName && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTagName('');
                                        inputRef.current?.focus();
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    <Image src="/icons/close.svg" alt="" width={14} height={14} className="dark:invert opacity-60" />
                                </button>
                            )}
                        </div>

                        {/* Suggestions dropdown */}
                        {isSuggestionsOpen && filteredSuggestions.length > 0 && (
                            <ul
                                ref={suggestionsRef}
                                className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 divide-y divide-gray-100 dark:divide-gray-800 text-sm"
                                role="listbox"
                            >
                                {filteredSuggestions.map((suggestion, index) => (
                                    <li
                                        key={suggestion + index}
                                        onClick={() => handleSelectSuggestion(suggestion)}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        className={`px-3 py-2 cursor-pointer transition flex items-center justify-between ${
                                            highlightedIndex === index
                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                        role="option"
                                        aria-selected={highlightedIndex === index}
                                    >
                                        <span className="truncate">{suggestion}</span>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm font-medium"
                            disabled={isSubmitting}
                        >
                            {t('cancel') || 'Cancel'}
                        </button>
                        <LoadingButton
                            type="submit"
                            isLoading={isSubmitting}
                            loadingText={t('processing') || 'Adding...'}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 text-sm font-medium"
                        >
                            {t('addTagToFolder') || 'Add Tag to Contents'}
                        </LoadingButton>
                    </div>
                </form>
            </div>
        </div>
    );
};

