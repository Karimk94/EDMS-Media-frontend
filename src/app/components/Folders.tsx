import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAdmin } from '../../hooks/useAdmin';
import { useDownload } from '../../hooks/useDownload';
import { FolderItem, useFolderContents } from '../../hooks/useFolderContents';
import { useFolderContentSearch } from '../../hooks/useFolderContentSearch';
import { useDeleteFolder, useMoveItemsMutation, useRenameFolder } from '../../hooks/useFolderMutations';
import { useMoveModalFolders } from '../../hooks/useMoveModalFolders';
import { useAuth } from '../../hooks/useAuth';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { Document } from '../../models/Document';
import { useToast } from '../context/ToastContext';
import { LoadingButton } from './LoadingButton';
import { Pagination } from './Pagination';
import { Spinner } from './Spinner';
import { FolderIcon } from './FolderIcon';
import { ThumbnailImage } from './ThumbnailImage';
import { useReviewStatus } from '../../hooks/useReviewStatus';
import { useRerunAnalysis } from '../../hooks/useSystemOperations';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { useFolderProcessingStatus } from '../../hooks/useFolderProcessingStatus';
import { useFolderProcessingSummary } from '../../hooks/useFolderProcessingSummary';
import { PersonOption } from '../../models/PersonOption';

// Lazy-loaded modals — only loaded when user opens them via context menu
const CreateFolderModal = React.lazy(() => import('./CreateFolderModal').then(m => ({ default: m.CreateFolderModal })));
const HistoryModal = React.lazy(() => import('./HistoryModal').then(m => ({ default: m.HistoryModal })));
const SecurityModal = React.lazy(() => import('./SecurityModal'));
const ShareModal = React.lazy(() => import('./ShareModal'));



interface FoldersProps {
    onFolderClick: (folderId: 'images' | 'videos' | 'files') => void;
    onDocumentClick?: (doc: Document) => void;
    onUploadClick: (parentId: string | null, parentName: string, files?: File[]) => void;
    t: Function;
    apiURL: string;
    isEditor: boolean;
    initialFolderId?: string | null;
    externalRefreshTrigger?: number;
    /** Global list of doc IDs being tracked for AI processing (from useProcessingStatus). */
    processingDocs?: number[];

    /** Search bar props when managed externally (e.g. from FilterBar) */
    folderSearchTerm?: string;
    onFolderSearchChange?: (term: string) => void;
    onFolderSearchFetchingChange?: (fetching: boolean) => void;

    /** Filter props passed down from FilterBar */
    selectedTags?: string[];
    selectedYears?: number[];
    dateFrom?: Date | null;
    dateTo?: Date | null;
    selectedPerson?: PersonOption[] | null;
    personCondition?: 'any' | 'all';
    filterMediaType?: 'image' | 'video' | 'pdf' | null;
    lang?: 'en' | 'ar';
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    item: FolderItem | null;
}

function formatBytes(bytes?: number): string {
    if (bytes === undefined || bytes === null || bytes === 0) return '--';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
    }).format(date);
}

export const Folders: React.FC<FoldersProps> = ({
    onFolderClick,
    onDocumentClick,
    onUploadClick,
    t,
    apiURL,
    isEditor: isEditorProp,
    initialFolderId,
    externalRefreshTrigger,
    processingDocs = [],
    folderSearchTerm,
    onFolderSearchChange,
    onFolderSearchFetchingChange,
    selectedTags = [],
    selectedYears = [],
    dateFrom = null,
    dateTo = null,
    selectedPerson = null,
    personCondition = 'any',
    filterMediaType = null,
    lang = 'en'
}) => {
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();

    const { useCheckAccess } = useAdmin();
    const { data: adminAccessData } = useCheckAccess();
    const hasAdminAccess = adminAccessData?.has_access === true;

    const { user } = useAuth();
    const { updateViewMode, isUpdatingViewMode } = useUserPreferences();

    // A "Viewer" by security level is never treated as an editor inside the
    // Folders section, even if stale per-tab can_write permission data would
    // otherwise grant write access. This keeps the completed-only document
    // filtering consistent with the Recent and Favorites sections, so a viewer
    // never sees a document before an editor has marked it "Completed".
    const isViewer = (user?.security_level || '').trim().toLowerCase() === 'viewer';
    const isEditor = isEditorProp && !isViewer;
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showDetailsSidebar, setShowDetailsSidebar] = useState(false);

    useEffect(() => {
        if (user?.view_mode) {
            setViewMode(user.view_mode as 'grid' | 'list');
        } else {
            const saved = localStorage.getItem('view_mode') as 'grid' | 'list';
            if (saved) setViewMode(saved);
        }
    }, [user?.view_mode]);

    const handleToggleViewMode = async (mode: 'grid' | 'list') => {
        setViewMode(mode);
        try {
            await updateViewMode(mode);
        } catch (error) {
            console.error("Failed to update view mode:", error);
        }
    };

    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<FolderItem | null>(null);

    const [currentFolderId, setCurrentFolderId] = useState<string | number | null>(initialFolderId || null);
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | number | null; name: string }[]>([
        { id: null, name: t('home') || 'Home' }
    ]);

    const [internalSearchTerm, setInternalSearchTerm] = useState('');
    const searchTerm = folderSearchTerm !== undefined ? folderSearchTerm : internalSearchTerm;
    const setSearchTerm = onFolderSearchChange || setInternalSearchTerm;
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const hasActiveFilters = Boolean(
        (selectedTags && selectedTags.length > 0) ||
        (selectedYears && selectedYears.length > 0) ||
        dateFrom ||
        dateTo ||
        (selectedPerson && selectedPerson.length > 0) ||
        filterMediaType
    );

    // Pagination state for the folder grid. Reset to 1 whenever the folder,
    // the search term, or filters change so the user always starts from the first page.
    const FOLDER_PAGE_SIZE = 60;
    const [folderPage, setFolderPage] = useState(1);

    // Reset to first page when navigating into a different folder or when the
    // (debounced) search term or filters change.
    useEffect(() => {
        setFolderPage(1);
    }, [currentFolderId, debouncedSearchTerm, selectedTags, selectedYears, dateFrom, dateTo, selectedPerson, personCondition, filterMediaType]);

    // Determine the media-type filter for the standard folders so the content
    // search is scoped correctly (e.g. only videos when inside the Videos folder).
    const contentSearchMediaType: 'image' | 'video' | 'pdf' | null =
        filterMediaType ? filterMediaType
        : currentFolderId === 'images' ? 'image'
        : currentFolderId === 'videos' ? 'video'
        : currentFolderId === 'files' ? 'pdf'
        : null;

    // During search, folder-name matches are only shown on page 1 (prepended
    // before the content/embedding results). On later pages only the content
    // search results are used, so we keep the folder query on page 1 to avoid
    // fetching folder-name matches we would discard.
    const { data, isLoading: isInitialLoading, isFetching } = useFolderContents({
        parentId: currentFolderId,
        searchTerm: debouncedSearchTerm,
        apiURL,
        page: debouncedSearchTerm ? 1 : folderPage,
        pageSize: FOLDER_PAGE_SIZE,
    });

    // Parallel content + embedding search (reuses the global /api/documents
    // engine that powers the Recents search). Runs when there is a search term
    // or active filters. The backend now performs a full hybrid search (vector + SQL text +
    // events) across the entire folder hierarchy with proper server-side
    // pagination — identical to the Recents tab. Results are merged with the
    // folder-name matches from useFolderContents below.
    const { data: contentSearchData, isFetching: isContentSearchFetching } = useFolderContentSearch({
        searchTerm: debouncedSearchTerm,
        apiURL,
        page: folderPage,
        pageSize: FOLDER_PAGE_SIZE,
        mediaType: contentSearchMediaType,
        lang: lang || (user?.lang as 'en' | 'ar') || 'en',
        isEnabled: !!debouncedSearchTerm || hasActiveFilters,
        selectedTags,
        selectedYears,
        dateFrom,
        dateTo,
        selectedPerson,
        personCondition,
    });

    // Notify parent about search fetching state for loading indicators
    useEffect(() => {
        onFolderSearchFetchingChange?.(isContentSearchFetching);
    }, [isContentSearchFetching, onFolderSearchFetchingChange]);

    const [hiddenItemIds, setHiddenItemIds] = useState<Set<string | number>>(new Set());

    // Merge folder-name matches (from /api/folders) with content/embedding
    // matches (from /api/documents?scope=folders). When there is no search term
    // and no filters only the folder contents are shown. During search the content/embedding
    // results are the primary paginated set (they now use the same hybrid vector
    // + SQL text + event engine as the Recents tab, with proper server-side
    // pagination). Folder-name matches from /api/folders are prepended on page 1
    // only (folders don't paginate through /api/documents). Duplicate files
    // (matched by both name and content) are deduplicated, keeping the
    // folder-name match first.
    const rawItems: FolderItem[] = React.useMemo(() => {
        const folderContents = data?.contents || [];
        if (!debouncedSearchTerm && !hasActiveFilters) return folderContents;

        const contentMatches = contentSearchData?.contents || [];
        const seenIds = new Set<string | number>();
        const merged: FolderItem[] = [];

        // On page 1, folder-name matches (folders + files matched by filename)
        // are shown first when searching by name so users can navigate into matching folders.
        if (folderPage === 1 && debouncedSearchTerm) {
            for (const item of folderContents) {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    merged.push(item);
                }
            }
        }
        // Content/embedding/filter matches fill the rest of the page.
        for (const item of contentMatches) {
            if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                merged.push(item);
            }
        }
        return merged;
    }, [data, contentSearchData, debouncedSearchTerm, hasActiveFilters, folderPage]);

    // When searching or filtering, pagination is driven by the content/embedding search
    // (which now returns correct total_pages from the server). When browsing,
    // pagination is driven by the folder contents query.
    const totalFolderPages = (debouncedSearchTerm || hasActiveFilters)
        ? (contentSearchData?.total_pages || 1)
        : (data?.total_pages || 1);

    // Derive document IDs from the raw folder contents so review statuses can be
    // fetched regardless of the viewer/editor role.
    const docIds = React.useMemo(() => rawItems.filter(item => item.type === 'file').map(item => item.id), [rawItems]);
    const { statuses: reviewStatuses, setDocumentStatus, setFolderStatus, isError: isReviewStatusError } = useReviewStatus(docIds, apiURL, isEditor);
    const { mutateAsync: rerunAnalysis } = useRerunAnalysis();

    // Viewers may only see file documents that have been marked "Completed"
    // (review status === 'verified') by an editor. Folders/sub-folders remain
    // visible to viewers regardless of status since they are organizational
    // containers. Editors see every item. If the review-status request fails,
    // fail open (show all items) instead of blocking the viewer on a spinner.
    const items = React.useMemo(() => {
        const visibleItems = rawItems.filter((item) => !hiddenItemIds.has(item.id));
        if (isEditor) return visibleItems;
        // Wait until review statuses have loaded before filtering, otherwise
        // viewers would briefly see unverified documents on every navigation.
        if (docIds.length > 0 && Object.keys(reviewStatuses).length === 0 && !isReviewStatusError) return [];
        if (isReviewStatusError) return visibleItems;
        return visibleItems.filter((item) => {
            if (item.type !== 'file') return true; // keep folders/sub-folders
            return reviewStatuses[item.id] === 'verified';
        });
    }, [rawItems, hiddenItemIds, isEditor, reviewStatuses, docIds.length, isReviewStatusError]);

    // True when a viewer is waiting on review-status data before the filtered
    // file list can be shown. Used to keep the spinner visible (instead of an
    // empty/incorrect grid) until filtering is complete.
    const isViewerWaitingForStatus = !isEditor
        && docIds.length > 0
        && Object.keys(reviewStatuses).length === 0
        && !isReviewStatusError;

    // True when a viewer's folder has file items but none are verified — used to
    // show an explanatory empty state instead of "This folder is empty".
    const isViewerFilteredEmpty = !isEditor
        && docIds.length > 0
        && Object.keys(reviewStatuses).length > 0
        && items.filter(i => i.type === 'file').length === 0
        && items.filter(i => i.type !== 'file').length === 0;

    // Auto-refresh the folder grid when any file in this folder finishes AI analysis.
    // Only polls when at least one docId here is in the global processingDocs set (opt-in).
    useFolderProcessingStatus({
        docIds,
        currentFolderId,
        processingDocs,
        apiURL,
    });

    const isInsideStandardFolder = ['images', 'videos', 'files'].includes(String(currentFolderId || ''));

    const standardItems = items.filter(item => item.is_standard && !isInsideStandardFolder);

    const userItems = items
        .filter(item => !item.is_standard)
        .sort((a, b) => {
            const aIsFolder = a.type === 'folder';
            const bIsFolder = b.type === 'folder';

            if (aIsFolder && !bIsFolder) return -1;
            if (!aIsFolder && bIsFolder) return 1;

            return a.name.localeCompare(b.name);
        });
    const [isOperationLoading, setIsOperationLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    // Incremented to bust browser-cached thumbnails after processing completes
    const [thumbnailRefreshKey, setThumbnailRefreshKey] = useState(0);
    const isLoading = isInitialLoading || isOperationLoading;

    // Auto-clear operation loading, refreshing & navigation when fetch settles
    useEffect(() => {
        if (!isFetching) {
            setIsOperationLoading(false);
            setIsRefreshing(false);
            setIsNavigating(false);
        }
    }, [isFetching]);

    // Collect folder IDs visible in the current grid (event folders / user folders).
    // Used to poll the batch processing-summary endpoint so we can detect when an
    // uploaded event folder finishes processing all its photos.
    const visibleFolderIds = React.useMemo(
        () => userItems.filter(item => item.type === 'folder').map(item => item.id),
        [userItems]
    );

    const handleFolderProcessingComplete = useCallback(() => {
        setThumbnailRefreshKey(prev => prev + 1);
    }, []);

    const { summaries: folderProcessingSummaries } = useFolderProcessingSummary({
        folderIds: visibleFolderIds,
        currentFolderId,
        apiURL,
        onFolderComplete: handleFolderProcessingComplete,
    });

    const [showCreateModal, setShowCreateModal] = useState(false);

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, item: null });
    const contextMenuRef = useRef<HTMLDivElement>(null);

    const estimateContextMenuHeight = (item: FolderItem | null) => {
        const header = 40;
        const row = 36;

        if (!item) {
            return header + row * 2 + 8;
        }

        let actions = 4; // share, rename, permissions, delete
        if (item.type === 'folder') actions += 2; // create subfolder + download as zip
        if (item.type !== 'folder') actions += 1; // download
        if (hasAdminAccess) actions += 1; // history

        return header + actions * row + 8;
    };

    const getSafeContextMenuPosition = (rawX: number, rawY: number, item: FolderItem | null) => {
        const viewportPadding = 8;
        const menuWidth = 192; // matches w-48
        const menuHeight = estimateContextMenuHeight(item);

        const maxX = window.innerWidth - menuWidth - viewportPadding;
        const maxY = window.innerHeight - menuHeight - viewportPadding;

        return {
            x: Math.max(viewportPadding, Math.min(rawX, maxX)),
            y: Math.max(viewportPadding, Math.min(rawY, maxY)),
        };
    };

    const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
    const [selectedSecurityItem, setSelectedSecurityItem] = useState<FolderItem | null>(null);

    // Share Modal State
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [itemToShare, setItemToShare] = useState<FolderItem | null>(null);

    const deleteFolderMutation = useDeleteFolder();
    const renameFolderMutation = useRenameFolder();
    const moveItemsMutation = useMoveItemsMutation();
    const { download, downloadAsync } = useDownload();

    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<FolderItem | null>(null);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [deleteMode, setDeleteMode] = useState<'standard' | 'force'>('standard');

    // Pending drag-and-drop move confirmation
    const [pendingMoveConfirm, setPendingMoveConfirm] = useState<{
        fileIds: (string | number)[];
        destination: FolderItem;
    } | null>(null);

    // Batch delete confirmation modal (replaces window.confirm)
    const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);


    const [itemToRename, setItemToRename] = useState<FolderItem | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);

    const [selectedFileIds, setSelectedFileIds] = useState<Set<string | number>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
    const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
    const dragGhostRef = useRef<HTMLDivElement | null>(null);
    const [marqueeSelection, setMarqueeSelection] = useState<{
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        additive: boolean;
        baseSelection: Set<string | number>;
        containerOffsetX: number;
        containerOffsetY: number;
        zoomFactor: number;
    } | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gridAreaRef = useRef<HTMLDivElement>(null);
    const fileTileRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const suppressItemClickRef = useRef(false);

    // Track OS-level (external) drag-over to show upload overlay
    const [isExternalDragOver, setIsExternalDragOver] = useState(false);
    const externalDragCounterRef = useRef(0); // track nested dragenter/dragleave pairs

    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [moveCurrentFolderId, setMoveCurrentFolderId] = useState<string | number | null>(null);
    const [moveBreadcrumbs, setMoveBreadcrumbs] = useState<{ id: string | number | null; name: string }[]>([{ id: null, name: t('home') || 'Home' }]);
    const [targetMoveFolderId, setTargetMoveFolderId] = useState<string | number | null>(null);
    const [moveItemIds, setMoveItemIds] = useState<string[]>([]);
    const [isBatchMoving, setIsBatchMoving] = useState(false);
    const [isBatchDeleting, setIsBatchDeleting] = useState(false);
    const [isBatchDownloading, setIsBatchDownloading] = useState(false);
    const [downloadingItemIds, setDownloadingItemIds] = useState<Set<string | number>>(new Set());

    // Use react-query hook for move modal folders with caching
    const { data: moveFolderItems = [], isLoading: isMoveFoldersLoading, isFetching: isMoveFoldersFetching } = useMoveModalFolders({
        parentId: moveCurrentFolderId,
        apiURL,
        isEnabled: isMoveModalOpen
    });
    const isMoveFoldersInitialLoading = isMoveFoldersLoading && moveFolderItems.length === 0;
    const isMoveFoldersRefreshing = isMoveFoldersFetching && moveFolderItems.length > 0;

    const { showToast, removeToast } = useToast();

    const selectedFiles = items.filter((item) => selectedFileIds.has(item.id) && item.type === 'file');
    const selectedFileCount = selectedFiles.length;
    const selectedItemCount = items.filter((item) => selectedFileIds.has(item.id)).length;

    // Debounce search term
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Sync breadcrumbs from backend data if available
    useEffect(() => {
        if (data?.breadcrumbs && Array.isArray(data.breadcrumbs)) {
            setBreadcrumbs([{ id: null, name: t('home') || 'Home' }, ...data.breadcrumbs]);
        }
    }, [data, t]);

    useEffect(() => {
        // Sync breadcrumbs from URL if present
        if (!searchParams) return;
        const breadcrumbsParam = searchParams.get('breadcrumbs');
        if (breadcrumbsParam) {
            try {
                const parsed = JSON.parse(breadcrumbsParam);
                if (Array.isArray(parsed)) {
                    setBreadcrumbs(parsed);
                }
            } catch (e) { console.error("Error parsing breadcrumbs", e); }
        }
    }, [searchParams]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            // Close Context Menu
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu({ ...contextMenu, visible: false });
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [contextMenu]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (confirmModalOpen) {
                    setConfirmModalOpen(false);
                    setItemToDelete(null);
                }
                if (itemToRename) {
                    setItemToRename(null);
                }
                if (isShareModalOpen) {
                    setIsShareModalOpen(false);
                }
            }
        };

        if (confirmModalOpen || itemToRename || isShareModalOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [confirmModalOpen, itemToRename, isShareModalOpen]);

    useEffect(() => {
        if (initialFolderId !== undefined) {
            setCurrentFolderId(initialFolderId);
        }
    }, [initialFolderId]);

    useEffect(() => {
        setSelectedFileIds(new Set());
        setIsSelectionMode(false);
        setLastClickedIndex(null);
        setFocusedItemIndex(null);
    }, [currentFolderId, debouncedSearchTerm]);

    useEffect(() => {
        setHiddenItemIds(new Set());
    }, [currentFolderId, debouncedSearchTerm]);

    // React to external refresh trigger (e.g. upload-complete from parent)
    const prevTriggerRef = useRef(externalRefreshTrigger);
    useEffect(() => {
        if (externalRefreshTrigger !== undefined && prevTriggerRef.current !== externalRefreshTrigger && prevTriggerRef.current !== undefined) {
            setIsOperationLoading(true);
        }
        prevTriggerRef.current = externalRefreshTrigger;
    }, [externalRefreshTrigger]);

    // Handle browser back/forward navigation
    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname;
            const searchParamsObj = new URLSearchParams(window.location.search);

            if (path === '/folders') {
                // Root folders view
                setCurrentFolderId(null);
                setBreadcrumbs([{ id: null, name: t('home') || 'Home' }]);
            } else if (path.startsWith('/folder/')) {
                // Extract folder ID from path
                const folderId = path.split('/folder/')[1]?.split('?')[0];
                if (folderId) {
                    setCurrentFolderId(folderId);

                    // Try to restore breadcrumbs from URL
                    const breadcrumbsParam = searchParamsObj.get('breadcrumbs');
                    if (breadcrumbsParam) {
                        try {
                            const parsed = JSON.parse(breadcrumbsParam);
                            if (Array.isArray(parsed)) {
                                setBreadcrumbs(parsed);
                            }
                        } catch (e) {
                            // Fallback breadcrumbs
                            const folderName = searchParamsObj.get('name') || folderId;
                            setBreadcrumbs([{ id: null, name: t('home') || 'Home' }, { id: folderId, name: folderName }]);
                        }
                    } else {
                        // Standard folder or no breadcrumbs in URL
                        if (['images', 'videos', 'files'].includes(folderId)) {
                            setBreadcrumbs([{ id: null, name: t('home') || 'Home' }, { id: folderId, name: t(folderId) || folderId }]);
                        } else {
                            const folderName = searchParamsObj.get('name') || folderId;
                            setBreadcrumbs([{ id: null, name: t('home') || 'Home' }, { id: folderId, name: folderName }]);
                        }
                    }
                }
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [t]);

    // Error handling for 404 is now easier if we want to redirect, 
    // but React Query handles errors via 'error' object or onError callbacks.
    // For now, we rely on the component rendering empty or error state if needed,
    // roughly mirroring the specialized 404 redirect if absolutely necessary.
    /*
      The previous fetchContents had a specific 404 redirect. 
      If we want to maintain exactly that, we can use the 'error' from the hook.
      But usually, simple error UI is better than redirect.
    */

    const getFolderHref = (item: FolderItem) => {
        if (item.is_standard) {
            return `/folder/${item.id}`;
        }
        const newBreadcrumbs = [...breadcrumbs, { id: item.id, name: item.name }];
        const json = JSON.stringify(newBreadcrumbs);
        // Include name param as backup
        return `/folder/${item.id}?breadcrumbs=${encodeURIComponent(json)}&name=${encodeURIComponent(item.name)}`;
    };

    const renderIcon = (item: FolderItem, isStandard = false) => {
        let iconSrc = '/folder-icon.svg';
        let altText = 'Folder';
        let size = 56; // Maps to h-14 w-14
        let invertClass = "";

        let type: string = 'folder';
        if (isStandard) {
            if (item.id === 'images') type = 'image';
            else if (item.id === 'videos') type = 'video';
            else type = 'file';
        } else {
            if (item.type === 'file') {
                const mType = getMediaType(item);
                type = mType;
            }
        }

        if (isStandard) {
            size = 24; // Maps to h-6 w-6
            invertClass = "";

            if (type === 'image') { iconSrc = '/file-image.svg'; altText = 'Images'; }
            else if (type === 'video') { iconSrc = '/file-video.svg'; altText = 'Videos'; }
            else { iconSrc = '/file-document.svg'; altText = 'Files'; }
        } else {
            const iconMap: Record<string, { src: string; alt: string }> = {
                'image': { src: '/file-image.svg', alt: 'Image' },
                'video': { src: '/file-video.svg', alt: 'Video' },
                'excel': { src: '/file-excel.svg', alt: 'Excel' },
                'pdf': { src: '/file-pdf.svg', alt: 'PDF' },
                'powerpoint': { src: '/file-powerpoint.svg', alt: 'PowerPoint' },
                'word': { src: '/file-word.svg', alt: 'Word' },
                'zip': { src: '/file-zip.svg', alt: 'Zip' },
                'audio': { src: '/file-audio.svg', alt: 'Audio' },
                'cad': { src: '/file-cad.svg', alt: 'CAD' },
                'code': { src: '/file-code.svg', alt: 'Code' },
                'email': { src: '/file-email.svg', alt: 'Email' },
                'font': { src: '/file-font.svg', alt: 'Font' },
                'database': { src: '/file-database.svg', alt: 'Database' },
                'vector': { src: '/file-vector.svg', alt: 'Vector' },
                'archive': { src: '/file-archive.svg', alt: 'Archive' },
                'executable': { src: '/file-executable.svg', alt: 'Executable' },
                'disc': { src: '/file-disc.svg', alt: 'Disc Image' },
                'visio': { src: '/file-visio.svg', alt: 'Visio' },
                'onenote': { src: '/file-onenote.svg', alt: 'OneNote' },
                'text': { src: '/file-document.svg', alt: 'File' },
                'file': { src: '/file-document.svg', alt: 'File' },
            };

            const mapped = iconMap[type];
            if (mapped) {
                iconSrc = mapped.src;
                altText = mapped.alt;
            } else {
                iconSrc = '/folder-icon.svg';
                altText = 'Folder';
            }
            invertClass = "";
        }

        if (type === 'image' && item.type === 'file' && !isStandard) {
            const cleanApiUrl = apiURL.replace(/\/$/, '');
            let thumbUrl = `${cleanApiUrl}/cache/${item.id}.jpg`;
            if (item.thumbnail_url?.trim()) {
                if (item.thumbnail_url.startsWith('http')) {
                    thumbUrl = item.thumbnail_url;
                } else {
                    const cleanThumb = item.thumbnail_url.replace(/^\//, '');
                    thumbUrl = `${cleanApiUrl}/${cleanThumb}`;
                }
            }
            // Only cache-bust thumbnails for docs that were actually being
            // processed (their thumbnail may have changed). For all other docs
            // the thumbnail is immutable, so we let the browser cache it — this
            // avoids needlessly re-downloading every thumbnail on each refresh.
            const itemId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
            const isBeingProcessed = Array.isArray(processingDocs) && itemId != null && !isNaN(itemId) && processingDocs.includes(itemId);
            const effectiveRefreshKey = isBeingProcessed ? thumbnailRefreshKey : 0;
            return (
                <div style={{ width: size, height: size }} className="relative overflow-hidden rounded-md flex items-center justify-center">
                    <ThumbnailImage
                        src={thumbUrl}
                        alt={altText}
                        className="object-cover w-full h-full"
                        fallbackSrc="/file-image.svg"
                        fallbackClassName="w-full h-full object-contain"
                        refreshKey={effectiveRefreshKey}
                    />
                </div>
            );
        }

        return <Image src={iconSrc} alt={altText} width={size} height={size} className={invertClass} />;
    };

    const getMediaType = useCallback((item: FolderItem) => {
        // If backend already resolved it to a specific type, rely on it
        if (item.media_type && item.media_type !== 'folder' && item.media_type !== 'file') {
            // Normalize docx to word if needed
            if (item.media_type === 'docx' as any) return 'word';
            return item.media_type;
        }

        const ext = item.name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '')) return 'image';
        if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext || '')) return 'video';
        if (['pdf'].includes(ext || '')) return 'pdf';
        if (['doc', 'docx'].includes(ext || '')) return 'word';
        if (['zip'].includes(ext || '')) return 'zip';
        if (['rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext || '')) return 'archive';
        if (['txt', 'csv', 'log', 'md'].includes(ext || '')) return 'text';
        if (['xls', 'xlsx', 'ods', 'xlsm'].includes(ext || '')) return 'excel';
        if (['ppt', 'pptx', 'odp', 'pps', 'ppsx'].includes(ext || '')) return 'powerpoint';
        if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(ext || '')) return 'audio';
        if (['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'stl', 'obj', '3ds', 'fbx'].includes(ext || '')) return 'cad';
        if (['py', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'java', 'cpp', 'c', 'cs', 'go', 'rb', 'php', 'swift', 'rs', 'r', 'sql', 'sh', 'bat', 'ps1', 'cmd'].includes(ext || '')) return 'code';
        if (['eml', 'msg', 'mbox'].includes(ext || '')) return 'email';
        if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext || '')) return 'font';
        if (['db', 'sqlite', 'mdb', 'accdb'].includes(ext || '')) return 'database';
        if (['ai', 'eps'].includes(ext || '')) return 'vector';
        if (['exe', 'msi'].includes(ext || '')) return 'executable';
        if (['iso', 'img', 'dmg', 'vhd'].includes(ext || '')) return 'disc';
        if (['vsd', 'vsdx'].includes(ext || '')) return 'visio';
        if (['one', 'onetoc2'].includes(ext || '')) return 'onenote';
        if (['json', 'xml', 'yml', 'yaml', 'ini', 'conf'].includes(ext || '')) return 'code';
        return 'file';
    }, []);

    // Helper function to update URL without full page reload (shallow routing)
    const updateUrlShallow = useCallback((folderId: string | number | null, newBreadcrumbs: { id: string | number | null; name: string }[]) => {
        if (folderId === null) {
            window.history.pushState(null, '', '/folders');
        } else if (['images', 'videos', 'files'].includes(String(folderId))) {
            window.history.pushState(null, '', `/folder/${folderId}`);
        } else {
            const breadcrumbsJson = JSON.stringify(newBreadcrumbs);
            const folderName = newBreadcrumbs.length > 0 ? newBreadcrumbs[newBreadcrumbs.length - 1].name : '';
            window.history.pushState(null, '', `/folder/${folderId}?breadcrumbs=${encodeURIComponent(breadcrumbsJson)}&name=${encodeURIComponent(folderName)}`);
        }
    }, []);

    const handleNavigate = useCallback((folder: FolderItem) => {
        if (folder.name.toLowerCase().endsWith('.zip') || folder.media_type === 'file') {
            showToast(t('contentCannotBeDisplayed') || "Content cannot be displayed", 'info');
            return;
        }

        // Clear search when navigating into a folder so its contents are shown
        if (folder.type === 'folder' || folder.is_standard || folder.node_type === 'N' || folder.node_type === 'F') {
            setSearchTerm('');
            setDebouncedSearchTerm('');
        }

        // Prevent navigating to the exact same folder we are already in (avoids duplicate breadcrumbs on rapid double-clicks while loading)
        if (breadcrumbs.length > 0 && breadcrumbs[breadcrumbs.length - 1].id === folder.id) {
            return;
        }

        if (folder.is_standard) {
            // For standard folders (images, videos, files), use internal state update
            setIsNavigating(true);
            setCurrentFolderId(String(folder.id));
            setBreadcrumbs([{ id: null, name: t('home') || 'Home' }, { id: String(folder.id), name: t(String(folder.id)) || folder.name }]);
            updateUrlShallow(String(folder.id), [{ id: null, name: t('home') || 'Home' }, { id: String(folder.id), name: t(String(folder.id)) || folder.name }]);
            return;
        }

        if (folder.type === 'file' || (folder.type !== 'folder' && folder.node_type !== 'N' && folder.node_type !== 'F')) {
            if (onDocumentClick) {
                let mediaType: any = 'file';
                const detectedType = getMediaType(folder);

                if (detectedType === 'image') mediaType = 'image';
                else if (detectedType === 'video') mediaType = 'video';
                else if (detectedType === 'pdf') mediaType = 'pdf';
                else if (detectedType === 'text') mediaType = 'text';
                else if (detectedType === 'excel') mediaType = 'excel';
                else if (detectedType === 'powerpoint') mediaType = 'powerpoint';
                else if (detectedType === 'word') mediaType = 'word';
                else if (detectedType === 'zip') mediaType = 'zip';
                else mediaType = 'file';

                const doc = new Document({
                    doc_id: parseInt(String(folder.id), 10),
                    docname: (folder as any).docname || folder.name,
                    title: (folder as any).title || '',
                    abstract: (folder as any).abstract || '',
                    media_type: mediaType,
                    date: (folder as any).date || new Date().toISOString(),
                    thumbnail_url: folder.thumbnail_url || `cache/${folder.id}.jpg`
                });
                onDocumentClick(doc);
            }
            return;
        }

        // Internal state navigation for dynamic folders (no full page reload)
        setIsNavigating(true);
        const newBreadcrumbs = [...breadcrumbs, { id: String(folder.id), name: folder.name }];
        setCurrentFolderId(String(folder.id));
        setBreadcrumbs(newBreadcrumbs);
        updateUrlShallow(String(folder.id), newBreadcrumbs);
    }, [breadcrumbs, onDocumentClick, showToast, t, updateUrlShallow, getMediaType]);

    const handleBreadcrumbClick = (index: number) => {
        const target = breadcrumbs[index];
        // Don't navigate if already on this crumb
        if (index === breadcrumbs.length - 1) return;
        setSearchTerm('');
        setDebouncedSearchTerm('');
        setIsNavigating(true);
        if (target.id === null) {
            // Navigate back to root folders
            setCurrentFolderId(null);
            setBreadcrumbs([{ id: null, name: t('home') || 'Home' }]);
            updateUrlShallow(null, [{ id: null, name: t('home') || 'Home' }]);
        } else {
            // Navigate back to a specific folder in the breadcrumb trail
            const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
            setCurrentFolderId(target.id);
            setBreadcrumbs(newBreadcrumbs);
            updateUrlShallow(target.id, newBreadcrumbs);
        }
    };

    const refreshCurrentView = (showOverlay = false) => {
        if (showOverlay) {
            setIsOperationLoading(true);
        } else {
            setIsRefreshing(true);
        }
        // Force refetch from server, bypassing stale time cache.
        // NOTE: during search the folder-name query is pinned to page 1 (folder
        // matches are only shown on page 1), so the key must match.
        const folderQueryPage = debouncedSearchTerm ? 1 : folderPage;
        queryClient.refetchQueries({ queryKey: ['folders', currentFolderId, debouncedSearchTerm, folderQueryPage, FOLDER_PAGE_SIZE] });
        queryClient.invalidateQueries({ queryKey: ['folder-content-search'] });
        queryClient.invalidateQueries({ queryKey: ['documents'] });
        // Also refresh review statuses, folder previews, and processing-related caches
        // so that newly processed items show their AI labels and thumbnails.
        queryClient.invalidateQueries({ queryKey: ['review_statuses'] });
        queryClient.invalidateQueries({ queryKey: ['folder_previews'] });
        queryClient.invalidateQueries({ queryKey: ['folder_processing_status'] });
        queryClient.invalidateQueries({ queryKey: ['folder_processing_summary'] });
        queryClient.invalidateQueries({ queryKey: ['processing_status'] });
        // Bump thumbnail refresh key so cached thumbnails are re-requested
        setThumbnailRefreshKey(prev => prev + 1);
    };

    const updateItemsInCurrentView = (updater: (item: FolderItem) => FolderItem) => {
        const folderQueryPage = debouncedSearchTerm ? 1 : folderPage;
        queryClient.setQueryData(['folders', currentFolderId, debouncedSearchTerm, folderQueryPage, FOLDER_PAGE_SIZE], (previous: any) => {
            if (!previous?.contents) return previous;

            return {
                ...previous,
                contents: previous.contents.map((item: FolderItem) => updater(item)),
            };
        });
    };

    const hideItemsFromCurrentView = (itemIds: (string | number)[]) => {
        if (itemIds.length === 0) return;

        const idsToHide = new Set(itemIds);
        setHiddenItemIds((prev) => {
            const next = new Set(prev);
            itemIds.forEach((id) => next.add(id));
            return next;
        });

        const folderQueryPage = debouncedSearchTerm ? 1 : folderPage;
        queryClient.setQueryData(['folders', currentFolderId, debouncedSearchTerm, folderQueryPage, FOLDER_PAGE_SIZE], (previous: any) => {
            if (!previous?.contents) return previous;

            return {
                ...previous,
                contents: previous.contents.filter((item: FolderItem) => !idsToHide.has(item.id)),
            };
        });
    };

    const clearSelection = () => {
        setSelectedFileIds(new Set());
        setLastClickedIndex(null);
    };

    useEffect(() => {
        const handleEscapeClearSelection = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (selectedFileIds.size === 0) return;
            clearSelection();
        };

        document.addEventListener('keydown', handleEscapeClearSelection);
        return () => document.removeEventListener('keydown', handleEscapeClearSelection);
    }, [selectedFileIds]);

    const toggleSelectionMode = () => {
        setIsSelectionMode((prev) => {
            if (prev) {
                setSelectedFileIds(new Set());
            }
            return !prev;
        });
    };

    const toggleFileSelection = (fileId: string | number, checked?: boolean) => {
        setSelectedFileIds(prev => {
            const next = new Set(prev);
            const isChecked = checked !== undefined ? checked : !next.has(fileId);

            if (isChecked) next.add(fileId);
            else next.delete(fileId);

            return next;
        });
    };

    const selectOnlyFile = (fileId: string) => {
        setSelectedFileIds(new Set([fileId]));
    };

    // --- Google Drive-style click handlers ---

    /** Single-click: select item. Ctrl+Click: additive. Shift+Click: range. */
    const handleItemClick = (item: FolderItem, e: React.MouseEvent) => {
        if (suppressItemClickRef.current) {
            suppressItemClickRef.current = false;
            return;
        }

        const itemIndex = userItems.findIndex((i) => i.id === item.id);

        if (e.shiftKey && lastClickedIndex !== null && isEditor) {
            // Shift+Click → range selection
            e.preventDefault();
            if (!isSelectionMode) setIsSelectionMode(true);
            const start = Math.min(lastClickedIndex, itemIndex);
            const end = Math.max(lastClickedIndex, itemIndex);
            setSelectedFileIds((prev) => {
                const next = new Set(prev);
                for (let i = start; i <= end; i++) {
                    next.add(userItems[i].id);
                }
                return next;
            });
            setFocusedItemIndex(itemIndex);
            return;
        }

        if ((e.ctrlKey || e.metaKey) && isEditor) {
            // Ctrl+Click → additive toggle
            e.preventDefault();
            if (!isSelectionMode) setIsSelectionMode(true);
            toggleFileSelection(item.id);
            setLastClickedIndex(itemIndex);
            setFocusedItemIndex(itemIndex);
            return;
        }

        // Plain click → select only this item
        if (!isSelectionMode) setIsSelectionMode(true);
        setSelectedFileIds(new Set([item.id]));
        setLastClickedIndex(itemIndex);
        setFocusedItemIndex(itemIndex);
    };

    /** Double-click: navigate into folder or open file */
    const handleItemDoubleClick = (item: FolderItem) => {
        handleNavigate(item);
    };

    const handleBatchDelete = useCallback(() => {
        if (selectedFileCount === 0) return;
        setBatchDeleteConfirmOpen(true);
    }, [selectedFileCount]);

    // --- Keyboard navigation ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't intercept when modals are open or input is focused
            const activeTag = document.activeElement?.tagName;
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
            if (confirmModalOpen || itemToRename || isShareModalOpen || isMoveModalOpen || showCreateModal) return;
            if (userItems.length === 0) return;

            const cols = (() => {
                const gridEl = gridAreaRef.current?.querySelector('.grid');
                if (!gridEl) return 5;
                const style = window.getComputedStyle(gridEl);
                const templateCols = style.getPropertyValue('grid-template-columns');
                return templateCols.split(' ').filter(Boolean).length || 5;
            })();

            const currentIdx = focusedItemIndex ?? -1;

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const next = Math.min(currentIdx + 1, userItems.length - 1);
                setFocusedItemIndex(next);
                if (!e.shiftKey) {
                    setSelectedFileIds(new Set([userItems[next].id]));
                    setLastClickedIndex(next);
                    if (!isSelectionMode) setIsSelectionMode(true);
                } else {
                    setSelectedFileIds((prev) => { const n = new Set(prev); n.add(userItems[next].id); return n; });
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const next = Math.max(currentIdx - 1, 0);
                setFocusedItemIndex(next);
                if (!e.shiftKey) {
                    setSelectedFileIds(new Set([userItems[next].id]));
                    setLastClickedIndex(next);
                    if (!isSelectionMode) setIsSelectionMode(true);
                } else {
                    setSelectedFileIds((prev) => { const n = new Set(prev); n.add(userItems[next].id); return n; });
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = Math.min(currentIdx + cols, userItems.length - 1);
                setFocusedItemIndex(next);
                if (!e.shiftKey) {
                    setSelectedFileIds(new Set([userItems[next].id]));
                    setLastClickedIndex(next);
                    if (!isSelectionMode) setIsSelectionMode(true);
                } else {
                    setSelectedFileIds((prev) => {
                        const n = new Set(prev);
                        for (let i = currentIdx + 1; i <= next; i++) n.add(userItems[i].id);
                        return n;
                    });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const next = Math.max(currentIdx - cols, 0);
                setFocusedItemIndex(next);
                if (!e.shiftKey) {
                    setSelectedFileIds(new Set([userItems[next].id]));
                    setLastClickedIndex(next);
                    if (!isSelectionMode) setIsSelectionMode(true);
                } else {
                    setSelectedFileIds((prev) => {
                        const n = new Set(prev);
                        for (let i = next; i < currentIdx; i++) n.add(userItems[i].id);
                        return n;
                    });
                }
            } else if (e.key === 'Enter' && focusedItemIndex !== null && focusedItemIndex >= 0) {
                e.preventDefault();
                handleNavigate(userItems[focusedItemIndex]);
            } else if (e.key === ' ' && focusedItemIndex !== null && focusedItemIndex >= 0) {
                e.preventDefault();
                toggleFileSelection(userItems[focusedItemIndex].id);
            } else if (e.key === 'Delete' && selectedFileIds.size > 0 && isEditor) {
                e.preventDefault();
                handleBatchDelete();
            } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (!isSelectionMode) setIsSelectionMode(true);
                setSelectedFileIds(new Set(userItems.map((i) => i.id)));
            } else if (e.key === 'F2' && selectedFileIds.size === 1 && isEditor) {
                e.preventDefault();
                const itemId = Array.from(selectedFileIds)[0];
                const focusedItem = userItems.find((i) => i.id === itemId);
                if (focusedItem && !focusedItem.is_standard) {
                    setItemToRename(focusedItem);
                    setRenameValue(focusedItem.name);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [focusedItemIndex, userItems, isSelectionMode, selectedFileIds, isEditor, confirmModalOpen, itemToRename, isShareModalOpen, isMoveModalOpen, showCreateModal, handleBatchDelete, handleNavigate]);

    const isRectIntersecting = (a: DOMRect, b: { left: number; right: number; top: number; bottom: number }) => {
        return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    };

    const startMarqueeSelection = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isEditor || e.button !== 0) return;

        const target = e.target as HTMLElement;
        if (target.closest('button,input,textarea,label,a,[data-no-marquee="true"]')) return;
        // Don't start marquee when clicking on an item tile
        if (target.closest('[data-select-item="true"],[data-folder-item="true"]')) return;

        const ctrlHeld = e.ctrlKey || e.metaKey;
        const additive = ctrlHeld;

        let zoomFactor = 1;
        if (typeof window !== 'undefined') {
            const htmlZoom = window.getComputedStyle(document.documentElement).zoom;
            if (htmlZoom && htmlZoom !== '1') {
                zoomFactor = htmlZoom.includes('%') ? parseFloat(htmlZoom) / 100 : parseFloat(htmlZoom);
            }
            if (isNaN(zoomFactor) || zoomFactor <= 0) zoomFactor = 1;
        }

        setMarqueeSelection({
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
            additive,
            baseSelection: new Set(selectedFileIds),
            containerOffsetX: 0,
            containerOffsetY: 0,
            zoomFactor,
        });
        suppressItemClickRef.current = false;
        e.preventDefault();
    };

    // --- OS drag-and-drop helpers ---

    /** Returns true only when the drag originates from outside the browser (real files from the OS). */
    const isOsDrag = (e: React.DragEvent<any>) => {
        const types = Array.from(e.dataTransfer.types);
        // 'Files' type is set by the OS; internal drags use 'application/json'
        return types.includes('Files') && !types.includes('application/json');
    };

    /**
     * Recursively reads all files from a DataTransferItem (handles folder drops
     * via the FileSystem API when available, falls back to .getAsFile()).
     */
    const readFilesFromEntry = (entry: FileSystemEntry): Promise<File[]> => {
        return new Promise((resolve) => {
            if (entry.isFile) {
                (entry as FileSystemFileEntry).file(
                    (file) => resolve([file]),
                    () => resolve([]),
                );
            } else if (entry.isDirectory) {
                const reader = (entry as FileSystemDirectoryEntry).createReader();
                const allFiles: File[] = [];
                const readBatch = () => {
                    reader.readEntries(async (entries) => {
                        if (entries.length === 0) {
                            resolve(allFiles);
                            return;
                        }
                        const nested = await Promise.all(entries.map(readFilesFromEntry));
                        nested.forEach((f) => allFiles.push(...f));
                        readBatch(); // keep reading until entries is empty
                    }, () => resolve(allFiles));
                };
                readBatch();
            } else {
                resolve([]);
            }
        });
    };

    const handleGridDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isEditor || !isOsDrag(e)) return;
        e.preventDefault();
        externalDragCounterRef.current += 1;
        if (externalDragCounterRef.current === 1) setIsExternalDragOver(true);
    };

    const handleGridDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isEditor || !isOsDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleGridDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isEditor) return;
        externalDragCounterRef.current -= 1;
        if (externalDragCounterRef.current <= 0) {
            externalDragCounterRef.current = 0;
            setIsExternalDragOver(false);
        }
    };

    const handleGridDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        if (!isEditor || !isOsDrag(e)) return;
        e.preventDefault();
        externalDragCounterRef.current = 0;
        setIsExternalDragOver(false);

        let collectedFiles: File[] = [];

        // Use DataTransferItemList + FileSystem API for recursive folder support
        const items = Array.from(e.dataTransfer.items);
        if (items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
            const entries = items
                .map((item) => item.webkitGetAsEntry())
                .filter((entry): entry is FileSystemEntry => entry !== null);
            const nested = await Promise.all(entries.map(readFilesFromEntry));
            nested.forEach((f) => collectedFiles.push(...f));
        } else {
            // Fallback: plain FileList (no folder recursion possible)
            collectedFiles = Array.from(e.dataTransfer.files);
        }

        if (collectedFiles.length === 0) return;
        onUploadClick(currentFolderId !== null ? String(currentFolderId) : null, getCurrentFolderName(), collectedFiles);
    };


    useEffect(() => {
        if (!marqueeSelection) return;

        const handleMouseMove = (e: MouseEvent) => {
            setMarqueeSelection(prev => {
                if (!prev) return prev;

                const next = {
                    ...prev,
                    currentX: e.clientX,
                    currentY: e.clientY,
                };

                const left = Math.min(next.startX, next.currentX);
                const right = Math.max(next.startX, next.currentX);
                const top = Math.min(next.startY, next.currentY);
                const bottom = Math.max(next.startY, next.currentY);

                if (Math.abs(next.currentX - next.startX) > 3 || Math.abs(next.currentY - next.startY) > 3) {
                    suppressItemClickRef.current = true;
                }

                const intersected = new Set<string | number>();
                items.forEach((item) => {
                    const node = fileTileRefs.current[item.id];
                    if (!node) return;
                    const rect = node.getBoundingClientRect();
                    if (isRectIntersecting(rect, { left, right, top, bottom })) {
                        intersected.add(item.id);
                    }
                });

                setSelectedFileIds(() => {
                    if (next.additive) {
                        const merged = new Set(next.baseSelection);
                        intersected.forEach((id) => merged.add(id));
                        return merged;
                    }
                    return intersected;
                });

                return next;
            });
        };

        const handleMouseUp = () => {
            setMarqueeSelection(prev => {
                if (!prev) return null;

                const wasClick = Math.abs(prev.currentX - prev.startX) <= 3 && Math.abs(prev.currentY - prev.startY) <= 3;
                if (wasClick && !prev.additive) {
                    clearSelection();
                }

                return null;
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [marqueeSelection, items]);

    const moveFilesToFolder = async (fileIds: (string | number)[], destinationFolderId: string | number | null) => {
        if (fileIds.length === 0) return;

        if (destinationFolderId === currentFolderId) {
            showToast(t('alreadyInThisFolder') || 'Selected files are already in this folder.', 'info');
            return;
        }

        setIsOperationLoading(true);
        setIsBatchMoving(true);
        let didTriggerRefresh = false;

        try {
            const itemNames = Object.fromEntries(
                fileIds
                    .map((id) => {
                        const matched = items.find((item) => item.id === id);
                        return matched ? [id, matched.name] : null;
                    })
                    .filter((entry): entry is [string, string] => Array.isArray(entry))
            );

            const result = await moveItemsMutation.mutateAsync({
                item_ids: fileIds,
                destination_parent_id: destinationFolderId,
                item_names: itemNames,
                apiURL
            });

            const moved = Number(result?.moved_count || 0);
            const failed = Number(result?.failed_count || 0);

            if (moved > 0) {
                showToast(t('successMoving') || `Moved ${moved} file(s) successfully.`, 'success');
            }
            if (failed > 0) {
                showToast(t('errorMoving') || `${failed} file(s) could not be moved.`, 'error');
            }

            if (moved > 0 && failed === 0) {
                hideItemsFromCurrentView(fileIds);
            }

            clearSelection();
            if (moved > 0 && failed === 0) {
                setIsSelectionMode(false);
            }
            didTriggerRefresh = true;
            refreshCurrentView(true);
        } catch (error: any) {
            setIsOperationLoading(false);
            showToast(t('errorMoving') || `Error moving files: ${error.message || 'Unknown error'}`, 'error');
        } finally {
            setIsBatchMoving(false);
            if (!didTriggerRefresh) {
                setIsOperationLoading(false);
            }
        }
    };

    const fetchMoveFolderItems = async (parentId: string | null) => {
        // No longer needed - useMoveModalFolders hook handles fetching with caching
        // This function is kept as a no-op for backward compatibility
    };

    const closeMoveModal = () => {
        setIsMoveModalOpen(false);
        setMoveItemIds([]);
    };

    const openMoveModal = async (fileIds: (string | number)[]) => {
        if (fileIds.length === 0) return;

        setMoveItemIds(fileIds.map(String));
        setIsMoveModalOpen(true);
        setMoveCurrentFolderId(null);
        setMoveBreadcrumbs([{ id: null, name: t('home') || 'Home' }]);
        setTargetMoveFolderId(currentFolderId);
        // No need to manually fetch - hook will load data automatically
    };

    const handleMoveModalNavigate = async (folder: FolderItem) => {
        const nextBreadcrumbs = [...moveBreadcrumbs, { id: String(folder.id), name: folder.name }];
        setMoveCurrentFolderId(String(folder.id));
        setMoveBreadcrumbs(nextBreadcrumbs);
        setTargetMoveFolderId(String(folder.id));
        // Hook automatically fetches data based on moveCurrentFolderId change
    };

    const handleMoveBreadcrumbClick = async (index: number) => {
        const target = moveBreadcrumbs[index];
        const nextBreadcrumbs = moveBreadcrumbs.slice(0, index + 1);
        setMoveBreadcrumbs(nextBreadcrumbs);
        setMoveCurrentFolderId(target.id);
        setTargetMoveFolderId(target.id);
        // Hook automatically fetches data based on moveCurrentFolderId change
    };

    const executeBatchDelete = async () => {
        setBatchDeleteConfirmOpen(false);
        if (selectedFileCount === 0) return;

        setIsOperationLoading(true);
        setIsBatchDeleting(true);

        let deleted = 0;
        let failed = 0;
        const deletedIds: (string | number)[] = [];
        let didTriggerRefresh = false;

        try {
            await Promise.all(Array.from(selectedFileIds).map(async (id) => {
                try {
                    await deleteFolderMutation.mutateAsync({ id: String(id), force: false, apiURL });
                    deleted += 1;
                    deletedIds.push(id);
                } catch {
                    failed += 1;
                }
            }));

            if (deleted > 0) {
                showToast(t('successDeleting') || `Deleted ${deleted} file(s) successfully.`, 'success');
            }
            if (failed > 0) {
                showToast(t('errorDeleting') || `${failed} file(s) could not be deleted.`, 'error');
            }

            hideItemsFromCurrentView(deletedIds);

            clearSelection();
            didTriggerRefresh = true;
            refreshCurrentView(true);
        } finally {
            setIsBatchDeleting(false);
            if (!didTriggerRefresh) {
                setIsOperationLoading(false);
            }
        }
    };

    const handleBatchDownload = async () => {
        if (selectedFileCount === 0) return;

        setIsBatchDownloading(true);
        let downloaded = 0;
        let failed = 0;

        for (const fileId of Array.from(selectedFileIds)) {
            const item = items.find(i => i.id === fileId);
            if (!item) continue;

            const mediaType = getMediaType(item);
            const toastId = showToast((t('downloadingFile') || "Downloading ") + item.name + "...", 'info', 'subtle', 0);

            try {
                await downloadAsync({ docId: item.id, docname: item.name, apiURL, mediaType });
                downloaded++;
            } catch (error) {
                failed++;
                showToast((t('errorDownloading') || "Error downloading ") + item.name, 'error');
            } finally {
                removeToast(toastId);
            }
        }

        if (downloaded > 0 && selectedFileCount > 1) {
            showToast(t('successDownloading') || `Downloaded ${downloaded} file(s) successfully.`, 'success');
        }
        if (failed > 0 && selectedFileCount > 1) {
            showToast(t('errorDownloadingBatch') || `${failed} file(s) could not be downloaded.`, 'error');
        }

        setIsBatchDownloading(false);
        clearSelection();
    };

    const handleRightClick = (e: React.MouseEvent, item: FolderItem) => {
        e.preventDefault();
        if (!isEditor) return;
        if (item.is_standard) return;

        const position = getSafeContextMenuPosition(e.clientX, e.clientY, item);

        setContextMenu({
            visible: true,
            x: position.x,
            y: position.y,
            item: item
        });
    };

    const handleBackgroundContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!isEditor) return;
        if (e.target !== e.currentTarget) return;

        const position = getSafeContextMenuPosition(e.clientX, e.clientY, null);

        setContextMenu({
            visible: true,
            x: position.x,
            y: position.y,
            item: null
        });
    };

    useEffect(() => {
        if (!contextMenu.visible || !contextMenuRef.current) return;

        const rect = contextMenuRef.current.getBoundingClientRect();
        const viewportPadding = 8;

        const adjustedX = Math.max(
            viewportPadding,
            Math.min(contextMenu.x, window.innerWidth - rect.width - viewportPadding)
        );
        const adjustedY = Math.max(
            viewportPadding,
            Math.min(contextMenu.y, window.innerHeight - rect.height - viewportPadding)
        );

        if (adjustedX !== contextMenu.x || adjustedY !== contextMenu.y) {
            setContextMenu(prev => ({ ...prev, x: adjustedX, y: adjustedY }));
        }
    }, [contextMenu.visible, contextMenu.x, contextMenu.y]);

    const getCurrentFolderName = () => {
        if (breadcrumbs.length > 0) {
            return breadcrumbs[breadcrumbs.length - 1].name;
        }
        return t('home') || 'Home';
    };

    const handleContextMenuAction = async (action: string) => {
        if (action === 'upload' && !contextMenu.item) {
            setContextMenu({ ...contextMenu, visible: false });
            onUploadClick(currentFolderId !== null ? String(currentFolderId) : null, getCurrentFolderName());
            return;
        }

        if (action === 'createFolder' && !contextMenu.item) {
            setContextMenu({ ...contextMenu, visible: false });
            setShowCreateModal(true);
            return;
        }

        if (!contextMenu.item) return;
        const targetItem = contextMenu.item;

        setContextMenu({ ...contextMenu, visible: false });

        if (action === 'select' && targetItem.type === 'file') {
            setIsSelectionMode(true);
            setSelectedFileIds((prev) => {
                const next = new Set(prev);
                next.add(targetItem.id);
                return next;
            });
            return;
        }

        if (action === 'deselect' && targetItem.type === 'file') {
            setSelectedFileIds((prev) => {
                const next = new Set(prev);
                next.delete(targetItem.id);
                return next;
            });
            return;
        }

        if (action === 'createChild' && targetItem.type === 'folder') {
            handleNavigate(targetItem);
            setShowCreateModal(true);
        }
        else if (action === 'rename') {
            setItemToRename(targetItem);
            setRenameValue(targetItem.name);
        }
        else if (action === 'delete') {
            setItemToDelete(targetItem);
            setDeleteMode('standard');
            setConfirmMessage(`${t('confirmDelete') || "Are you sure you want to delete"} "${targetItem.name}"?`);
            setConfirmModalOpen(true);
        }
        else if (action === 'history') {
            setSelectedHistoryItem(targetItem);
            setIsHistoryModalOpen(true);
        }
        else if (action === 'security') {
            setSelectedSecurityItem(targetItem);
            setIsSecurityModalOpen(true);
        }
        else if (action === 'share') {
            setItemToShare(targetItem);
            setIsShareModalOpen(true);
        }
        else if (action === 'download') {
            handleDownload(targetItem);
        }
        else if (action === 'downloadZip') {
            handleDownloadFolderZip(targetItem);
        }
        else if (action === 'moveFile' && targetItem.type === 'file') {
            openMoveModal([targetItem.id]);
        }
        else if (action === 'markVerified' || action === 'markPending') {
            const status = action === 'markVerified' ? 'verified' : 'pending';
            try {
                await setDocumentStatus({ docId: targetItem.id, status });
                showToast(t('statusUpdated') || 'Status updated successfully', 'success');
            } catch (e: any) {
                showToast(t('errorUpdatingStatus') || 'Error updating status', 'error');
            }
        }
        else if (action === 'rerunAnalysis') {
            try {
                await rerunAnalysis({ docId: targetItem.id, apiURL });
                showToast(t('analysisQueued') || 'Document queued for analysis', 'success');
            } catch (e: any) {
                showToast(t('errorQueuingAnalysis') || 'Error queuing analysis', 'error');
            }
        }
        else if (action === 'markFolderVerified' || action === 'markFolderPending') {
            const status = action === 'markFolderVerified' ? 'verified' : 'pending';
            try {
                await setFolderStatus({ folderId: String(targetItem.id), status });
                showToast(t('statusUpdated') || 'Folder status updated successfully', 'success');
            } catch (e: any) {
                showToast(t('errorUpdatingStatus') || 'Error updating folder status', 'error');
            }
        }
        else if (action === 'moveSelected') {
            openMoveModal(Array.from(selectedFileIds));
        }
        else if (action === 'deleteSelected') {
            handleBatchDelete();
        }
    };

    const handleDownload = (item: FolderItem) => {
        const toastId = showToast(t('downloading') || "Downloading...", 'info', 'subtle', 0);
        setDownloadingItemIds(prev => { const next = new Set(prev); next.add(item.id); return next; });
        const mediaType = getMediaType(item);
        download(
            { docId: item.id, docname: item.name, apiURL, mediaType },
            {
                onSuccess: () => {
                    removeToast(toastId);
                    setDownloadingItemIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
                },
                onError: () => {
                    removeToast(toastId);
                    setDownloadingItemIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
                    showToast(t('errorDownloading'), 'error');
                }
            }
        );
    };

    const handleDownloadFolderZip = async (item: FolderItem) => {
        showToast(t('zipSkipsFoldersNotice') || "Note: only files in this folder will be downloaded. Subfolders are skipped.", 'info');
        const toastId = showToast(t('downloadingZip') || "Preparing ZIP download...", 'info', 'subtle', 0);
        setDownloadingItemIds(prev => { const next = new Set(prev); next.add(item.id); return next; });
        try {
            const response = await fetch(`${apiURL}/folders/${item.id}/download-zip`, {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                if (response.status === 413) {
                    let errMsg = t('folderTooLarge') || "Unable to download: folder size exceeds the limit. Please download individual files instead.";
                    try {
                        const errData = await response.json();
                        if (errData && errData.detail) errMsg = errData.detail;
                    } catch (e) { }
                    showToast(errMsg, 'error');
                } else if (response.status === 404) {
                    showToast("Folder has no files to download", 'error');
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
                removeToast(toastId);
                return;
            }

            // Check if response is JSON (multipart manifest) or Blob (single ZIP)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const manifest = await response.json();
                removeToast(toastId);

                if (manifest.multipart && manifest.total_parts > 0) {
                    const partsCount = manifest.total_parts;
                    showToast(`Large folder detected. Downloading in ${partsCount} parts...`, 'info');

                    // Download parts sequentially
                    for (let i = 1; i <= partsCount; i++) {
                        const partToastId = showToast(`Downloading part ${i} of ${partsCount}...`, 'info', 'subtle', 0);
                        try {
                            const partResponse = await fetch(`${apiURL}/folders/${item.id}/download-zip?part=${i}`, {
                                method: 'GET',
                                credentials: 'include',
                            });

                            if (!partResponse.ok) throw new Error(`HTTP ${partResponse.status}`);

                            const blob = await partResponse.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;

                            // Try to get filename from Content-Disposition header, fallback to part_filename
                            const disposition = partResponse.headers.get('Content-Disposition');
                            let filename = `${manifest.folder_name}_Part${i}of${partsCount}.zip`;
                            if (disposition) {
                                const match = disposition.match(/filename="?([^"]+)"?/);
                                if (match && match[1]) filename = match[1];
                            }

                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        } catch (err) {
                            console.error(`Failed to download part ${i}`, err);
                            showToast(`Failed to download part ${i} of ${partsCount}`, 'error');
                        } finally {
                            removeToast(partToastId);
                        }
                    }
                    showToast(`Finished downloading ${partsCount} parts`, 'success');
                }
            } else {
                // Single ZIP file
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                // Try to get filename from Content-Disposition header
                const disposition = response.headers.get('Content-Disposition');
                let filename = `${item.name}.zip`;
                if (disposition) {
                    const match = disposition.match(/filename="?([^"]+)"?/);
                    if (match && match[1]) filename = match[1];
                }

                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                removeToast(toastId);
            }
        } catch (err) {
            removeToast(toastId);
            showToast(t('zipDownloadError') || "Failed to download folder as ZIP", 'error');
        } finally {
            setDownloadingItemIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
        }
    };

    const handleRenameSubmit = async (e?: React.FormEvent | React.FocusEvent) => {
        if (e) e.preventDefault();
        if (isRenaming) return; // Prevent double execution from onBlur + onSubmit
        if (!itemToRename || !renameValue || renameValue === itemToRename.name) {
            setItemToRename(null);
            return;
        }

        setIsRenaming(true);
        setIsOperationLoading(true);
        let didTriggerRefresh = false;
        try {
            const nextName = renameValue;

            await renameFolderMutation.mutateAsync({
                id: itemToRename.id,
                name: nextName,
                system_id: itemToRename.system_id,
                apiURL
            });

            updateItemsInCurrentView((item) => (
                item.id === itemToRename.id ? { ...item, name: nextName } : item
            ));

            showToast(t('successRenaming'), 'success');
            setItemToRename(null);
            didTriggerRefresh = true;
            refreshCurrentView(true);
        } catch (e: any) {
            console.error("Rename error:", e);
            setIsOperationLoading(false);
            showToast(t('errorRenaming') || `Error: ${e.message}`, 'error');
        } finally {
            setIsRenaming(false);
            if (!didTriggerRefresh) {
                setIsOperationLoading(false);
            }
        }
    };

    const processDelete = async () => {
        if (!itemToDelete) return;

        setIsOperationLoading(true);
        let didTriggerRefresh = false;

        if (deleteMode === 'standard') {
            setConfirmModalOpen(false);
        }

        try {
            await deleteFolderMutation.mutateAsync({
                id: itemToDelete.id,
                force: deleteMode === 'force',
                apiURL
            });

            hideItemsFromCurrentView([itemToDelete.id]);

            setItemToDelete(null);
            setConfirmModalOpen(false);
            showToast(t('successDeleting'), 'success');
            didTriggerRefresh = true;
            refreshCurrentView(true);

        } catch (e: any) {
            let errMsg = "";
            let errDetail = "";

            if (e.data) {
                errMsg = (e.data.detail || e.data.error || "").toLowerCase();
                errDetail = e.data.detail || e.data.error;
            } else {
                errMsg = e.message.toLowerCase();
                errDetail = e.message;
            }

            const hasSubfolders = errMsg.includes("contains subfolders");

            if (hasSubfolders) {
                setDeleteMode('standard');
                setItemToDelete(null);
                setConfirmModalOpen(false);
                showToast(t('folderContainsSubfolders') || errDetail || 'This folder cannot be deleted because it contains subfolders.', 'warning');
            } else if (deleteMode === 'standard' && (e.status === 409 || errMsg.includes("referenced") || errMsg.includes("folder") || errMsg.includes("unable to locate"))) {
                setDeleteMode('force');
                setConfirmMessage(t('referencedItemError') || "This item is currently referenced by other records or is not empty.");
                setConfirmModalOpen(true);
            } else {
                showToast(t('errorDeleting') || `Error: ${errDetail || 'Unknown error'}`, 'error');
                if (deleteMode === 'force') {
                    setConfirmModalOpen(false);
                }
            }
        } finally {
            if (!didTriggerRefresh) {
                setIsOperationLoading(false);
            }
        }
    };

    const getStandardFolderColor = (id: string | number) => {
        return 'bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700';
    };

    const getFileColorClass = (item: FolderItem) => {
        if (item.type === 'folder') return 'text-yellow-500 dark:text-yellow-400';

        const type = getMediaType(item);
        const colorMap: Record<string, string> = {
            'image': 'text-purple-500 dark:text-purple-400',
            'video': 'text-pink-500 dark:text-pink-400',
            'pdf': 'text-red-500 dark:text-red-400',
            'word': 'text-blue-500 dark:text-blue-400',
            'excel': 'text-green-500 dark:text-green-400',
            'powerpoint': 'text-orange-500 dark:text-orange-400',
            'zip': 'text-gray-500 dark:text-gray-400',
            'text': 'text-gray-600 dark:text-gray-300',
            'audio': 'text-cyan-500 dark:text-cyan-400',
            'cad': 'text-indigo-500 dark:text-indigo-400',
            'code': 'text-teal-500 dark:text-teal-400',
            'archive': 'text-yellow-600 dark:text-yellow-500',
            'executable': 'text-red-600 dark:text-red-500',
            'disc': 'text-gray-400 dark:text-gray-500',
            'database': 'text-blue-600 dark:text-blue-500',
            'email': 'text-blue-400 dark:text-blue-300',
            'font': 'text-gray-700 dark:text-gray-200',
            'visio': 'text-blue-800 dark:text-blue-600',
            'onenote': 'text-purple-700 dark:text-purple-500',
        };

        return colorMap[type] || 'text-yellow-500 dark:text-yellow-400';
    };

    return (
        <div ref={containerRef} className="flex flex-col h-full bg-white dark:bg-[#1e1e1e] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden relative">


            <div className="relative border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252525]">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar flex-grow">
                        {breadcrumbs.length > 1 && (
                            <button
                                onClick={() => handleBreadcrumbClick(breadcrumbs.length - 2)}
                                className="flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                                title={t('back') || 'Go back one directory'}
                                aria-label={t('back') || 'Go back one directory'}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                                <span>{t('back') || 'Back'}</span>
                            </button>
                        )}
                        <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {breadcrumbs.map((crumb, index) => (
                                <div key={index} className="flex items-center whitespace-nowrap">
                                    {index > 0 && <span className="mx-2 text-gray-400">/</span>}
                                    <button
                                        onClick={() => handleBreadcrumbClick(index)}
                                        className={`hover:text-blue-500 hover:underline transition-colors ${index === breadcrumbs.length - 1 ? 'font-bold text-gray-900 dark:text-white' : ''
                                            }`}
                                    >
                                        {crumb.name}
                                    </button>
                                </div>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center space-x-3 ml-4">
                        <button
                            onClick={() => refreshCurrentView()}
                            disabled={isRefreshing || isFetching}
                            className={`p-2 transition ${isRefreshing || isFetching
                                ? 'text-blue-500 dark:text-blue-400 cursor-not-allowed opacity-70'
                                : 'text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400'
                                }`}
                            title={t('refresh')}
                        >
                            <Image src="/icons/refresh.svg" alt="" width={20} height={20} className={`${isRefreshing || isFetching ? 'animate-spin' : ''} dark:invert`} />
                        </button>

                        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1 mx-2">
                            <button
                                onClick={() => handleToggleViewMode('grid')}
                                disabled={isUpdatingViewMode}
                                className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                                title={t('gridView') || 'Grid View'}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            </button>
                            <button
                                onClick={() => handleToggleViewMode('list')}
                                disabled={isUpdatingViewMode}
                                className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                                title={t('listView') || 'List View'}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            </button>
                            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1 self-center"></div>
                            <button
                                onClick={() => setShowDetailsSidebar(!showDetailsSidebar)}
                                className={`p-1.5 rounded-md transition ${showDetailsSidebar ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                                title={t('details') || 'Details'}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            </button>
                        </div>

                        {isEditor && (
                            <button
                                onClick={toggleSelectionMode}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition shadow-sm text-sm font-medium ${isSelectionMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                            >
                                <Image src="/icons/select.svg" alt="" width={20} height={20} className="dark:invert" />
                                {isSelectionMode ? (t('doneSelecting') || 'Done') : (t('select') || 'Select')}
                            </button>
                        )}

                        {isEditor && (<button
                            onClick={() => onUploadClick(currentFolderId !== null ? String(currentFolderId) : null, getCurrentFolderName())}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition shadow-sm text-sm font-medium"
                        >
                            <Image src="/upload.svg" alt="" width={20} height={20} className="invert dark:invert-0" />
                            {t('upload')}
                        </button>
                        )}

                        {isEditor && (
                            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md text-sm font-medium">
                                <Image src="/icons/plus.svg" alt="" width={20} height={20} className="dark:invert" />
                                {t('createFolder')}
                            </button>
                        )}
                    </div>
                </div>

                {isSelectionMode && isEditor && selectedItemCount > 0 && (
                    <div className="absolute inset-0 z-10 flex items-center justify-between px-6 bg-blue-50 dark:bg-blue-950/90 border-b border-blue-200 dark:border-blue-800">
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                            {(t('selectedFilesCount') || `${selectedItemCount} item(s) selected`).replace('{count}', String(selectedItemCount))}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleBatchDownload}
                                disabled={isBatchMoving || isBatchDeleting || isBatchDownloading || selectedFileCount === 0}
                                className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1"
                            >
                                {isBatchDownloading ? (
                                    <>
                                        <Image src="/icons/refresh.svg" alt="" width={14} height={14} className="animate-spin dark:invert" />
                                        {t('downloading') || 'Downloading...'}
                                    </>
                                ) : (
                                    <>
                                        <Image src="/download.svg" alt="" width={14} height={14} className="invert" />
                                        {t('download') || 'Download'}
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => openMoveModal(Array.from(selectedFileIds))}
                                disabled={isBatchMoving || isBatchDeleting || isBatchDownloading || selectedItemCount === 0}
                                className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                                {isBatchMoving ? (t('moving')) : (t('move') || 'Move')}
                            </button>
                            <LoadingButton
                                onClick={handleBatchDelete}
                                isLoading={isBatchDeleting}
                                loadingText={t('deleting') || 'Deleting...'}
                                disabled={isBatchMoving || isBatchDownloading || selectedItemCount === 0}
                                className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                            >
                                {t('delete') || 'Delete'}
                            </LoadingButton>
                            <button
                                onClick={clearSelection}
                                disabled={isBatchMoving || isBatchDeleting || isBatchDownloading}
                                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
                            >
                                {t('clear') || 'Clear'}
                            </button>
                            <button
                                onClick={toggleSelectionMode}
                                disabled={isBatchMoving || isBatchDeleting || isBatchDownloading}
                                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
                            >
                                {t('doneSelecting') || 'Done'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-row min-h-0 relative">
                <div
                    ref={gridAreaRef}
                    className="flex-1 overflow-y-auto p-6 relative"
                    onContextMenu={handleBackgroundContextMenu}
                    onMouseDown={startMarqueeSelection}
                    onDragEnter={handleGridDragEnter}
                    onDragOver={handleGridDragOver}
                    onDragLeave={handleGridDragLeave}
                    onDrop={handleGridDrop}
                >
                    {/* OS drag-and-drop overlay */}
                    {isExternalDragOver && isEditor && (
                        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center pointer-events-none rounded-xl border-4 border-dashed border-blue-500 bg-blue-500/10 backdrop-blur-[2px] transition-all">
                            <div className="flex flex-col items-center gap-3 bg-white/90 dark:bg-[#1e1e1e]/90 rounded-2xl px-10 py-8 shadow-2xl border border-blue-200 dark:border-blue-800">
                                <div className="text-blue-500 animate-bounce">
                                    <Image src="/upload.svg" alt="" width={48} height={48} className="invert dark:invert-0" />
                                </div>
                                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">Drop to Upload</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                                    Files &amp; folders will be added to<br />
                                    <span className="font-semibold text-gray-700 dark:text-gray-200">{getCurrentFolderName()}</span>
                                </p>
                            </div>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="py-8">
                            <Spinner size="lg" center label={t('loading') || 'Loading...'} />
                        </div>
                    ) : isNavigating && isFetching ? (
                        <div className="py-8">
                            <Spinner size="lg" center label={t('loading') || 'Loading...'} />
                        </div>
                    ) : isViewerWaitingForStatus ? (
                        <div className="py-8">
                            <Spinner size="lg" center label={t('loading') || 'Loading...'} />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">

                            {standardItems.length > 0 && !searchTerm && (
                                <div className="animate-fade-in">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">
                                        {t('libraries') || 'Quick Access'}
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {standardItems.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => handleNavigate(item)}
                                                className={`group flex items-center p-4 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${getStandardFolderColor(item.id)}`}
                                            >
                                                <div className="flex-shrink-0 p-2 bg-white dark:bg-[#333] rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                                    {renderIcon(item, true)}
                                                </div>
                                                <div className="ml-4 flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{t(item.id)}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.count !== undefined ? `${item.count} ${t('items')}` : ''}</p>
                                                </div>
                                                <div className="text-gray-300 dark:text-gray-600">
                                                    <Image src="/icons/chevron-right.svg" alt="" width={20} height={20} className="dark:invert" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex-1">
                                {(standardItems.length > 0 && userItems.length > 0 && !searchTerm) && (
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">{t('folders') || 'Folders'}</h3>
                                )}

                                <div className="mb-4">
                                    {viewMode === 'grid' ? (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                                            {userItems.map((item) => {
                                                const isFile = item.type === 'file';
                                                const isSelected = selectedFileIds.has(item.id);
                                                const isDragOverTarget = dragOverFolderId === item.id;

                                                if (!isFile && item.type === 'folder') {
                                                    const isFocused = focusedItemIndex !== null && userItems[focusedItemIndex]?.id === item.id;
                                                    return (
                                                        <div
                                                            ref={(el) => {
                                                                fileTileRefs.current[item.id] = el;
                                                            }}
                                                            data-folder-item="true"
                                                            key={item.id}
                                                            onClick={(e) => handleItemClick(item, e)}
                                                            onDoubleClick={() => handleItemDoubleClick(item)}
                                                            onContextMenu={(e) => handleRightClick(e, item)}
                                                            onDragOver={(e) => {
                                                                if (!isEditor) return;
                                                                e.preventDefault();
                                                                setDragOverFolderId(item.id);
                                                            }}
                                                            onDragLeave={() => {
                                                                if (dragOverFolderId === item.id) {
                                                                    setDragOverFolderId(null);
                                                                }
                                                            }}
                                                            onDrop={async (e) => {
                                                                if (!isEditor) return;
                                                                e.preventDefault();
                                                                e.stopPropagation(); // prevent grid-level OS-drop handler firing
                                                                setDragOverFolderId(null);

                                                                // If this is an OS file drag, upload to this folder
                                                                if (isOsDrag(e)) {
                                                                    externalDragCounterRef.current = 0;
                                                                    setIsExternalDragOver(false);

                                                                    let collectedFiles: File[] = [];
                                                                    const dragItems = Array.from(e.dataTransfer.items);
                                                                    if (dragItems.length > 0 && typeof dragItems[0].webkitGetAsEntry === 'function') {
                                                                        const entries = dragItems
                                                                            .map((dragItem) => dragItem.webkitGetAsEntry())
                                                                            .filter((entry): entry is FileSystemEntry => entry !== null);
                                                                        const nested = await Promise.all(entries.map(readFilesFromEntry));
                                                                        nested.forEach((f) => collectedFiles.push(...f));
                                                                    } else {
                                                                        collectedFiles = Array.from(e.dataTransfer.files);
                                                                    }

                                                                    if (collectedFiles.length > 0) {
                                                                        onUploadClick(String(item.id), item.name, collectedFiles);
                                                                    }
                                                                    return;
                                                                }

                                                                // Only handle internal file drags
                                                                let draggedIds: string[] = [];
                                                                try {
                                                                    const raw = e.dataTransfer.getData('application/json');
                                                                    if (raw) {
                                                                        const parsed = JSON.parse(raw);
                                                                        if (Array.isArray(parsed?.fileIds)) {
                                                                            draggedIds = parsed.fileIds;
                                                                        }
                                                                    }
                                                                } catch {
                                                                    draggedIds = [];
                                                                }

                                                                const idsToMove = draggedIds.length > 0 ? draggedIds : Array.from(selectedFileIds);
                                                                if (idsToMove.length === 0) return;

                                                                // Stage the move — show confirmation dialog instead of moving immediately
                                                                setPendingMoveConfirm({ fileIds: idsToMove, destination: item });
                                                            }}
                                                            className={`group relative flex flex-col items-center p-2 rounded-xl cursor-pointer transition-all duration-200 border hover:bg-gray-50 hover:shadow-sm dark:hover:bg-[#2c2c2c] ${isDragOverTarget ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-500' : isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'} ${isFocused ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-[#1e1e1e]' : ''}`}
                                                        >
                                                            {/* Downloading overlay (ZIP download) */}
                                                            {downloadingItemIds.has(item.id) && (
                                                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-white/70 dark:bg-[#1e1e1e]/70 backdrop-blur-[1px]">
                                                                    <Spinner size="sm" />
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('downloading') || 'Downloading...'}</span>
                                                                </div>
                                                            )}
                                                            {/* Grip / drag icon on selected folders */}
                                                            {isSelected && isEditor && (
                                                                <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 transition-opacity duration-200 cursor-grab active:cursor-grabbing select-none" title={t('dragToMove') || 'Drag to move'}>
                                                                    <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor" className="text-gray-400 dark:text-gray-500">
                                                                        <circle cx="4" cy="2" r="1.2" /><circle cx="8" cy="2" r="1.2" /><circle cx="12" cy="2" r="1.2" />
                                                                        <circle cx="4" cy="7" r="1.2" /><circle cx="8" cy="7" r="1.2" /><circle cx="12" cy="7" r="1.2" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                            {/* Checkbox on selected */}
                                                            {isEditor && isSelected && (
                                                                <label className="absolute top-2 left-2 z-10 flex items-center justify-center w-5 h-5 rounded border border-blue-400 dark:border-blue-500 bg-blue-500 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleFileSelection(item.id, e.target.checked);
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="h-3.5 w-3.5 accent-blue-500"
                                                                    />
                                                                </label>
                                                            )}
                                                            <div className="mb-2 transform group-hover:scale-105 transition-transform duration-200 text-gray-400 group-hover:text-blue-500 relative">
                                                                <FolderIcon item={item} apiURL={apiURL} isStandard={false} renderDefaultIcon={renderIcon} thumbnailRefreshKey={thumbnailRefreshKey} />
                                                                {(() => {
                                                                    const ps = folderProcessingSummaries[String(item.id)];
                                                                    if (ps && ps.processing > 0) {
                                                                        const label = (t('processingXOfY') || '{{done}}/{{total}}')
                                                                            .replace('{{done}}', String(ps.done))
                                                                            .replace('{{total}}', String(ps.total));
                                                                        return (
                                                                            <div className="absolute -top-1 -right-1 z-10 flex items-center gap-1 bg-blue-500 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full shadow-sm">
                                                                                <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse"></span>
                                                                                {label}
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                            {itemToRename?.id === item.id ? (
                                                                <form onSubmit={handleRenameSubmit} className="w-full px-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                                                                    <input
                                                                        type="text"
                                                                        value={renameValue}
                                                                        onChange={(e) => setRenameValue(e.target.value)}
                                                                        onBlur={handleRenameSubmit}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Escape') setItemToRename(null);
                                                                        }}
                                                                        className="w-full text-sm font-medium text-center text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-blue-500"
                                                                        autoFocus
                                                                        onFocus={(e) => e.target.select()}
                                                                    />
                                                                </form>
                                                            ) : (
                                                                <span className="text-sm font-medium text-center text-gray-700 dark:text-gray-300 break-words w-full line-clamp-2 px-1" title={item.name}>
                                                                    {item.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                const isFocused = focusedItemIndex !== null && userItems[focusedItemIndex]?.id === item.id;
                                                return (
                                                    <div
                                                        ref={(el) => {
                                                            fileTileRefs.current[item.id] = el;
                                                        }}
                                                        data-select-item="true"
                                                        key={item.id}
                                                        onClick={(e) => handleItemClick(item, e)}
                                                        onDoubleClick={() => handleItemDoubleClick(item)}
                                                        onContextMenu={(e) => handleRightClick(e, item)}
                                                        draggable={isEditor}
                                                        onDragStart={(e) => {
                                                            const payloadIds = isSelected && selectedItemCount > 1
                                                                ? Array.from(selectedFileIds)
                                                                : [item.id];
                                                            e.dataTransfer.setData('application/json', JSON.stringify({ fileIds: payloadIds }));
                                                            e.dataTransfer.effectAllowed = 'move';

                                                            // Custom drag ghost with count badge
                                                            if (payloadIds.length > 1 && dragGhostRef.current) {
                                                                const ghost = dragGhostRef.current;
                                                                ghost.textContent = `${payloadIds.length} items`;
                                                                ghost.style.display = 'flex';
                                                                document.body.appendChild(ghost);
                                                                e.dataTransfer.setDragImage(ghost, 40, 20);
                                                                requestAnimationFrame(() => {
                                                                    ghost.style.display = 'none';
                                                                    if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
                                                                });
                                                            }
                                                        }}
                                                        onDragEnd={() => setDragOverFolderId(null)}
                                                        className={`group relative flex flex-col items-center p-2 rounded-xl cursor-pointer transition-all duration-200 border hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm dark:hover:bg-[#2c2c2c] dark:hover:border-gray-700 ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-transparent'} ${isFocused ? 'ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-[#1e1e1e]' : ''}`}
                                                    >
                                                        {/* Downloading overlay */}
                                                        {downloadingItemIds.has(item.id) && (
                                                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-white/70 dark:bg-[#1e1e1e]/70 backdrop-blur-[1px]">
                                                                <Spinner size="sm" />
                                                                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('downloading') || 'Downloading...'}</span>
                                                            </div>
                                                        )}
                                                        {/* Grip / drag icon on selected items */}
                                                        {isSelected && isEditor && (
                                                            <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 transition-opacity duration-200 cursor-grab active:cursor-grabbing select-none" title={t('dragToMove') || 'Drag to move'}>
                                                                <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor" className="text-gray-400 dark:text-gray-500">
                                                                    <circle cx="4" cy="2" r="1.2" /><circle cx="8" cy="2" r="1.2" /><circle cx="12" cy="2" r="1.2" />
                                                                    <circle cx="4" cy="7" r="1.2" /><circle cx="8" cy="7" r="1.2" /><circle cx="12" cy="7" r="1.2" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                        {/* Review Status Badge — editors only; viewers never see badges */}
                                                        {reviewStatuses[item.id] && isEditor && (
                                                            <ReviewStatusBadge status={reviewStatuses[item.id]} t={t} />
                                                        )}
                                                        {/* Checkbox on selected */}
                                                        {isEditor && isSelected && (
                                                            <label className="absolute top-2 left-2 z-10 flex items-center justify-center w-5 h-5 rounded border border-blue-400 dark:border-blue-500 bg-blue-500 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleFileSelection(item.id, e.target.checked);
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="h-3.5 w-3.5 accent-blue-500"
                                                                />
                                                            </label>
                                                        )}
                                                        <div className={`mb-2 transform group-hover:scale-105 transition-transform duration-200 ${isFile ? getFileColorClass(item) : 'text-gray-400 group-hover:text-blue-500'}`}>
                                                            {renderIcon(item, false)}
                                                        </div>
                                                        {itemToRename?.id === item.id ? (
                                                            <form onSubmit={handleRenameSubmit} className="w-full px-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="text"
                                                                    value={renameValue}
                                                                    onChange={(e) => setRenameValue(e.target.value)}
                                                                    onBlur={handleRenameSubmit}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Escape') setItemToRename(null);
                                                                    }}
                                                                    className="w-full text-sm font-medium text-center text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-blue-500"
                                                                    autoFocus
                                                                    onFocus={(e) => e.target.select()}
                                                                />
                                                            </form>
                                                        ) : (
                                                            <span className="text-sm font-medium text-center text-gray-700 dark:text-gray-300 break-words w-full line-clamp-2 px-1" title={item.name}>
                                                                {item.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-[#1a1a1a]">
                                            <table className="w-full text-left border-collapse text-sm">
                                                <thead className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-gray-700">
                                                    <tr>
                                                        <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Name</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 w-32">Type</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 w-32">Size</th>
                                                        <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 w-48">Last Modified</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                    {userItems.map((item) => {
                                                        const isFile = item.type === 'file';
                                                        const isSelected = selectedFileIds.has(item.id);
                                                        const isDragOverTarget = dragOverFolderId === item.id;
                                                        const isFocused = focusedItemIndex !== null && userItems[focusedItemIndex]?.id === item.id;

                                                        return (
                                                            <tr
                                                                ref={(el) => {
                                                                    fileTileRefs.current[item.id] = el;
                                                                }}
                                                                data-folder-item={!isFile ? "true" : undefined}
                                                                data-select-item={isFile ? "true" : undefined}
                                                                key={item.id}
                                                                onClick={(e) => handleItemClick(item, e)}
                                                                onDoubleClick={() => handleItemDoubleClick(item)}
                                                                onContextMenu={(e) => handleRightClick(e, item)}
                                                                draggable={isEditor}
                                                                onDragOver={!isFile ? (e) => {
                                                                    if (!isEditor) return;
                                                                    e.preventDefault();
                                                                    setDragOverFolderId(item.id);
                                                                } : undefined}
                                                                onDragLeave={!isFile ? () => {
                                                                    if (dragOverFolderId === item.id) setDragOverFolderId(null);
                                                                } : undefined}
                                                                onDrop={!isFile ? async (e) => {
                                                                    if (!isEditor) return;
                                                                    e.preventDefault(); e.stopPropagation();
                                                                    setDragOverFolderId(null);

                                                                    // If this is an OS file drag, upload to this folder
                                                                    if (isOsDrag(e)) {
                                                                        externalDragCounterRef.current = 0;
                                                                        setIsExternalDragOver(false);

                                                                        let collectedFiles: File[] = [];
                                                                        const dragItems = Array.from(e.dataTransfer.items);
                                                                        if (dragItems.length > 0 && typeof dragItems[0].webkitGetAsEntry === 'function') {
                                                                            const entries = dragItems
                                                                                .map((dragItem) => dragItem.webkitGetAsEntry())
                                                                                .filter((entry): entry is FileSystemEntry => entry !== null);
                                                                            const nested = await Promise.all(entries.map(readFilesFromEntry));
                                                                            nested.forEach((f) => collectedFiles.push(...f));
                                                                        } else {
                                                                            collectedFiles = Array.from(e.dataTransfer.files);
                                                                        }

                                                                        if (collectedFiles.length > 0) {
                                                                            onUploadClick(String(item.id), item.name, collectedFiles);
                                                                        }
                                                                        return;
                                                                    }

                                                                    let draggedIds: string[] = [];
                                                                    try {
                                                                        const raw = e.dataTransfer.getData('application/json');
                                                                        if (raw) {
                                                                            const parsed = JSON.parse(raw);
                                                                            if (Array.isArray(parsed?.fileIds)) draggedIds = parsed.fileIds;
                                                                        }
                                                                    } catch { draggedIds = []; }
                                                                    const idsToMove = draggedIds.length > 0 ? draggedIds : Array.from(selectedFileIds);
                                                                    if (idsToMove.length === 0) return;
                                                                    setPendingMoveConfirm({ fileIds: idsToMove, destination: item });
                                                                } : undefined}
                                                                onDragStart={(e) => {
                                                                    const payloadIds = isSelected && selectedItemCount > 1 ? Array.from(selectedFileIds) : [item.id];
                                                                    e.dataTransfer.setData('application/json', JSON.stringify({ fileIds: payloadIds }));
                                                                    e.dataTransfer.effectAllowed = 'move';
                                                                    if (payloadIds.length > 1 && dragGhostRef.current) {
                                                                        const ghost = dragGhostRef.current;
                                                                        ghost.textContent = `${payloadIds.length} items`;
                                                                        ghost.style.display = 'flex';
                                                                        document.body.appendChild(ghost);
                                                                        e.dataTransfer.setDragImage(ghost, 40, 20);
                                                                        requestAnimationFrame(() => { ghost.style.display = 'none'; if (ghost.parentNode) ghost.parentNode.removeChild(ghost); });
                                                                    }
                                                                }}
                                                                onDragEnd={() => setDragOverFolderId(null)}
                                                                className={`group cursor-pointer transition-colors ${isDragOverTarget ? 'bg-blue-50 dark:bg-blue-900/30' : isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-[#2c2c2c]'} ${isFocused ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                                                            >
                                                                <td className="px-4 py-3 relative">
                                                                    {downloadingItemIds.has(item.id) && (
                                                                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-[#1a1a1a]/60 backdrop-blur-[1px] rounded">
                                                                            <Spinner size="xs" />
                                                                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{t('downloading') || 'Downloading...'}</span>
                                                                        </div>
                                                                    )}
                                                                    {isSelected && isEditor && (
                                                                        <div className="absolute left-1 cursor-grab active:cursor-grabbing text-gray-400" title={t('dragToMove') || 'Drag to move'}>
                                                                            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2" cy="4" r="1.2" /><circle cx="2" cy="8" r="1.2" /><circle cx="2" cy="12" r="1.2" /><circle cx="7" cy="4" r="1.2" /><circle cx="7" cy="8" r="1.2" /><circle cx="7" cy="12" r="1.2" /></svg>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex-shrink-0 w-6 h-6 flex justify-center items-center ml-2">
                                                                        {isEditor && isSelected ? (
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isSelected}
                                                                                onChange={(e) => { e.stopPropagation(); toggleFileSelection(item.id, e.target.checked); }}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="h-4 w-4 accent-blue-500 rounded cursor-pointer"
                                                                            />
                                                                        ) : (
                                                                            <span className={!isFile ? 'text-gray-400 dark:text-gray-500' : getFileColorClass(item)}>
                                                                                {renderIcon(item, false)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {itemToRename?.id === item.id ? (
                                                                        <form onSubmit={handleRenameSubmit} className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                                                                            <input
                                                                                type="text"
                                                                                value={renameValue}
                                                                                onChange={(e) => setRenameValue(e.target.value)}
                                                                                onBlur={handleRenameSubmit}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Escape') setItemToRename(null);
                                                                                }}
                                                                                className="w-full text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-blue-500 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                                                                                autoFocus
                                                                                onFocus={(e) => e.target.select()}
                                                                            />
                                                                        </form>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 flex-1 min-w-0 ml-1">
                                                                            <span className="font-medium text-gray-800 dark:text-gray-200 truncate" title={item.name}>
                                                                                {item.name}
                                                                            </span>
                                                                            {reviewStatuses[item.id] && isEditor && (
                                                                                <div className="flex-shrink-0 flex items-center">
                                                                                    <ReviewStatusBadge status={reviewStatuses[item.id]} t={t} absolute={false} />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">
                                                                    {!isFile ? 'Folder' : getMediaType(item)}
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                                    {!isFile ? '--' : formatBytes(item.size)}
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                                    {formatDate(item.date)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Pagination — shown when browsing (folder contents) or
                                    searching (content/embedding results). Both paths now use
                                    server-side pagination with correct total_pages. */}
                                {totalFolderPages > 1 && (
                                    <Pagination
                                        currentPage={folderPage}
                                        totalPages={totalFolderPages}
                                        onPageChange={setFolderPage}
                                        t={t}
                                    />
                                )}

                                {items.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                        <p>{isViewerFilteredEmpty
                                            ? (t('noCompletedDocuments') || "No completed documents are available yet.")
                                            : (searchTerm ? t('noDocumentsFound') : (t('emptyFolder') || "This folder is empty."))}</p>
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>

                {/* Details Sidebar */}
                {showDetailsSidebar && (
                    <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f1f1f] flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20 flex-shrink-0">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">{t('details') || 'Details'}</h3>
                            <button onClick={() => setShowDetailsSidebar(false)} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                                <Image src="/icons/close.svg" alt="" width={16} height={16} className="dark:invert opacity-60 hover:opacity-100" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5">
                            {(() => {
                                if (selectedItemCount === 1) {
                                    const selectedId = Array.from(selectedFileIds)[0];
                                    const selectedItem = items.find((i) => i.id === selectedId);
                                    if (!selectedItem) return null;
                                    const isFile = selectedItem.type === 'file' || (selectedItem.type !== 'folder' && selectedItem.node_type !== 'N' && selectedItem.node_type !== 'F');
                                    const mediaType = !isFile ? 'folder' : getMediaType(selectedItem);
                                    return (
                                        <div className="flex flex-col items-center">
                                            <div className={`w-32 h-32 flex items-center justify-center rounded-2xl mb-5 ${isFile ? getFileColorClass(selectedItem) : 'text-gray-400 bg-gray-50 dark:bg-[#2a2a2a]'}`}>
                                                <div className="transform scale-[2.5]">
                                                    {renderIcon(selectedItem, false)}
                                                </div>
                                            </div>
                                            <h4 className="text-center font-bold text-gray-800 dark:text-gray-200 mb-8 break-words w-full px-2">{selectedItem.name}</h4>

                                            <div className="w-full space-y-4">
                                                <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-2">{t('properties') || 'Properties'}</h5>
                                                <div className="flex flex-col gap-3.5 text-sm">
                                                    <div className="flex justify-between items-start gap-4">
                                                        <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{t('type') || 'Type'}</span>
                                                        <span className="text-gray-800 dark:text-gray-200 font-medium capitalize text-right">{mediaType}</span>
                                                    </div>
                                                    <div className="flex justify-between items-start gap-4">
                                                        <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{t('size') || 'Size'}</span>
                                                        <span className="text-gray-800 dark:text-gray-200 font-medium text-right">{!isFile ? '--' : formatBytes(selectedItem.size)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-start gap-4">
                                                        <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{t('modified') || 'Modified'}</span>
                                                        <span className="text-gray-800 dark:text-gray-200 font-medium text-right break-words">{formatDate(selectedItem.date)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                } else if (selectedItemCount > 1) {
                                    return (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 pt-10">
                                            <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-500">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                            </div>
                                            <p className="text-center font-medium text-gray-700 dark:text-gray-300">
                                                {selectedItemCount} {(t('itemsWord') || 'items')} selected
                                            </p>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 pt-10">
                                            <div className="p-5 bg-gray-50 dark:bg-[#2a2a2a] rounded-full text-gray-400">
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-semibold text-gray-700 dark:text-gray-300">{getCurrentFolderName()}</p>
                                                <p className="text-sm mt-1.5 text-gray-400">{items.length} {(t('itemsWord') || 'items')} total</p>
                                            </div>
                                        </div>
                                    );
                                }
                            })()}
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden drag ghost for multi-item drag preview */}
            <div
                ref={dragGhostRef}
                style={{ display: 'none', position: 'fixed', top: -1000, left: -1000, pointerEvents: 'none', zIndex: 9999 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-xl whitespace-nowrap"
            />

            {marqueeSelection && (
                <div
                    className="fixed z-[250] border border-blue-500 bg-blue-400/15 pointer-events-none"
                    style={{
                        left: Math.min(marqueeSelection.startX, marqueeSelection.currentX) / marqueeSelection.zoomFactor,
                        top: Math.min(marqueeSelection.startY, marqueeSelection.currentY) / marqueeSelection.zoomFactor,
                        width: Math.abs(marqueeSelection.currentX - marqueeSelection.startX) / marqueeSelection.zoomFactor,
                        height: Math.abs(marqueeSelection.currentY - marqueeSelection.startY) / marqueeSelection.zoomFactor,
                    }}
                />
            )}

            {contextMenu.visible && (
                <div
                    ref={contextMenuRef}
                    className="absolute z-[220] bg-white dark:bg-[#333] border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl w-48 py-1"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px`, position: 'fixed' }}
                >
                    {contextMenu.item ? (
                        <div
                            className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-500 uppercase tracking-wider break-all"
                            title={contextMenu.item.name}
                        >
                            {contextMenu.item.name}
                        </div>
                    ) : (
                        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {t('folderActions') || 'Folder Actions'}
                        </div>
                    )}

                    {!contextMenu.item && isEditor && (
                        <>
                            <button
                                onClick={() => handleContextMenuAction('upload')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                            >
                                <Image src="/upload.svg" width={16} height={16} className="invert dark:invert-0" alt="" />
                                {t('upload')}
                            </button>
                            <button
                                onClick={() => handleContextMenuAction('createFolder')}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                            >
                                <Image src="/icons/plus.svg" width={16} height={16} className="dark:invert" alt="" />
                                {t('createFolder')}
                            </button>
                        </>
                    )}

                    {isEditor && contextMenu.item?.type === 'folder' && (
                        <button
                            onClick={() => handleContextMenuAction('createChild')}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                        >
                            <Image src="/icons/plus.svg" width={16} height={16} className="dark:invert" alt="" />
                            {t('createSubfolder') || 'Create Subfolder'}
                        </button>
                    )}

                    {isEditor && contextMenu.item?.type === 'folder' && (
                        <>
                            <button
                                onClick={() => handleContextMenuAction('markFolderVerified')}
                                className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 flex items-center gap-2"
                            >
                                <Image src="/icons/status-completed.svg" width={16} height={16} alt="" />
                                {t('markFolderVerified') || 'Mark all Verified'}
                            </button>
                            <button
                                onClick={() => handleContextMenuAction('markFolderPending')}
                                className="w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 flex items-center gap-2"
                            >
                                <Image src="/icons/status-pending.svg" width={16} height={16} alt="" />
                                {t('markFolderPending') || 'Mark all Pending'}
                            </button>
                        </>
                    )}

                    {isEditor && contextMenu.item?.type === 'folder' && (
                        <button
                            onClick={() => handleContextMenuAction('downloadZip')}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                        >
                            <Image src="/download.svg" width={16} height={16} className="dark:invert" alt="" />
                            <span className="flex flex-col">
                                <span>{t('downloadAsZip') || 'Download as ZIP'}</span>
                            </span>
                        </button>
                    )}

                    {contextMenu.item && (
                        <>
                            {isEditor && contextMenu.item.type === 'file' && (
                                <button
                                    onClick={() => handleContextMenuAction(selectedFileIds.has(contextMenu.item!.id) ? 'deselect' : 'select')}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                    <Image src="/icons/select.svg" width={16} height={16} className="dark:invert" alt="" />
                                    {selectedFileIds.has(contextMenu.item.id)
                                        ? (t('deselect') || 'Deselect')
                                        : (
                                            <span className="flex w-full items-center justify-between gap-3">
                                                <span>{t('select') || 'Select'}</span>
                                                <span className="text-gray-400 dark:text-gray-500">Ctrl + Click</span>
                                            </span>
                                        )}
                                </button>
                            )}

                            {isSelectionMode && contextMenu.item.type === 'file' && selectedFileCount > 0 && selectedFileIds.has(contextMenu.item.id) && (
                                <>
                                    <button
                                        onClick={() => handleContextMenuAction('moveSelected')}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                    >
                                        <Image src="/icons/move-selected.svg" width={16} height={16} className="dark:invert" alt="" />
                                        {t('moveSelected') || 'Move selected'}
                                    </button>
                                    <button
                                        onClick={() => handleContextMenuAction('deleteSelected')}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                                    >
                                        <Image src="/icons/trash.svg" width={16} height={16} className="dark:invert" alt="" />
                                        {t('deleteSelected') || 'Delete selected'}
                                    </button>
                                    <div className="mx-2 my-1 border-t border-gray-100 dark:border-gray-700" />
                                </>
                            )}

                            {isEditor && contextMenu.item.type !== 'folder' && (
                                <>
                                    <button
                                        onClick={() => handleContextMenuAction('moveFile')}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                    >
                                        <Image src="/icons/move-selected.svg" width={16} height={16} className="dark:invert" alt="" />
                                        {t('moveFile') || 'Move file'}
                                    </button>
                                    <button
                                        onClick={() => handleContextMenuAction('download')}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                    >
                                        <Image src="/download.svg" width={16} height={16} className="dark:invert" alt="" />
                                        {t('download') || 'Download'}
                                    </button>
                                    {isEditor && (
                                        <>
                                            <button
                                                onClick={() => handleContextMenuAction('markVerified')}
                                                className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 flex items-center gap-2"
                                            >
                                                <Image src="/icons/status-completed.svg" width={16} height={16} alt="" />
                                                {t('markVerified') || 'Mark as Verified'}
                                            </button>
                                            <button
                                                onClick={() => handleContextMenuAction('markPending')}
                                                className="w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 flex items-center gap-2"
                                            >
                                                <Image src="/icons/status-pending.svg" width={16} height={16} alt="" />
                                                {t('markPending') || 'Mark as Pending'}
                                            </button>
                                            <button
                                                onClick={() => handleContextMenuAction('rerunAnalysis')}
                                                className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                                                {t('rerunAnalysis') || 'Rerun Analysis'}
                                            </button>
                                        </>
                                    )}
                                </>
                            )}

                            {isEditor && (
                                <button
                                    onClick={() => handleContextMenuAction('share')}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                    <Image src="/icons/share.svg" width={16} height={16} className="dark:invert" alt="" />
                                    {t('share') || 'Share'}
                                </button>
                            )}

                            {isEditor && (
                                <button
                                    onClick={() => handleContextMenuAction('rename')}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                    <Image src="/icons/rename.svg" width={16} height={16} className="dark:invert" alt="" />
                                    {t('rename') || 'Rename'}
                                </button>
                            )}

                            {isEditor && (
                                <button
                                    onClick={() => handleContextMenuAction('security')}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                    <Image src="/icons/lock.svg" width={16} height={16} className="dark:invert" alt="" />
                                    {t('permissions') || 'Permissions'}
                                </button>
                            )}

                            {isEditor && (
                                <button
                                    onClick={() => handleContextMenuAction('delete')}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                                >
                                    <Image src="/icons/trash.svg" width={16} height={16} className="dark:invert" alt="" />
                                    {t('delete') || 'Delete'}
                                </button>
                            )}

                            {hasAdminAccess && (
                                <button
                                    onClick={() => handleContextMenuAction('history')}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                    <Image src="/admin-icon.svg" width={16} height={16} className="dark:invert opacity-70" alt="" />
                                    {t('history') || 'History'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            <Suspense fallback={null}>
                {isHistoryModalOpen && selectedHistoryItem && (
                    <HistoryModal
                        isOpen={isHistoryModalOpen}
                        onClose={() => setIsHistoryModalOpen(false)}
                        docId={selectedHistoryItem.id}
                        itemName={selectedHistoryItem.name}
                        t={t}
                    />
                )}

                {showCreateModal && (
                    <CreateFolderModal
                        onClose={() => setShowCreateModal(false)}
                        apiURL={apiURL}
                        t={t}
                        initialParentId={currentFolderId || ''}
                        onFolderCreated={() => refreshCurrentView(true)}
                    />
                )}

                {isSecurityModalOpen && selectedSecurityItem && (
                    <SecurityModal
                        isOpen={isSecurityModalOpen}
                        onClose={() => setIsSecurityModalOpen(false)}
                        docId={selectedSecurityItem.id}
                        library="RTA_MAIN"
                        itemName={selectedSecurityItem.name}
                        t={t}
                    />
                )}

                {isShareModalOpen && itemToShare && (
                    <ShareModal
                        isOpen={isShareModalOpen}
                        onClose={() => {
                            setIsShareModalOpen(false);
                            setItemToShare(null);
                        }}
                        documentId={itemToShare.type !== 'folder' ? itemToShare.id : undefined}
                        folderId={itemToShare.type === 'folder' ? itemToShare.id : undefined}
                        documentName={itemToShare.name}
                        itemType={itemToShare.type === 'folder' ? 'folder' : 'file'}
                        t={t}
                    />
                )}
            </Suspense>

            {confirmModalOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 animate-fade-in"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setConfirmModalOpen(false);
                            setItemToDelete(null);
                        }
                    }}
                >
                    <div className="bg-white dark:bg-[#333] rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-200 dark:border-gray-600">
                        <div className={`flex items-center gap-3 mb-4 ${deleteMode === 'force' ? 'text-amber-500' : 'text-red-500'}`}>
                            <Image src={deleteMode === 'force' ? '/icons/warning.svg' : '/icons/trash.svg'} alt="" width={32} height={32} className="dark:invert" />
                            <h3 className="text-lg font-bold dark:text-white">
                                {deleteMode === 'force' ? (t('warning') || 'Warning') : (t('delete') || 'Delete Item')}
                            </h3>
                        </div>

                        <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm whitespace-pre-wrap">
                            {confirmMessage}
                            {deleteMode === 'force' && (
                                <>
                                    <br /><br />
                                    {t('confirmForceDelete') || "Do you want to delete it anyway? This will remove all contents and references."}
                                </>
                            )}
                        </p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setConfirmModalOpen(false);
                                    setItemToDelete(null);
                                }}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                {t('cancel') || 'Cancel'}
                            </button>
                            <LoadingButton
                                onClick={processDelete}
                                isLoading={isLoading}
                                className={`px-4 py-2 text-sm text-white rounded transition-colors shadow-sm ${deleteMode === 'force' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {deleteMode === 'force' ? (t('yesDelete') || 'Yes, Delete') : (t('delete') || 'Delete')}
                            </LoadingButton>
                        </div>
                    </div>
                </div>
            )}

            {isMoveModalOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4 animate-fade-in"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeMoveModal();
                        }
                    }}
                >
                    <div className="bg-white dark:bg-[#333] rounded-lg p-5 max-w-xl w-full shadow-xl border border-gray-200 dark:border-gray-600 max-h-[80vh] flex flex-col">
                        <h3 className="text-lg font-bold mb-3 dark:text-white">{t('moveToFolder') || 'Move to folder'}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            {t('doubleClickFolderHint')}
                        </p>

                        <div className="flex items-center flex-wrap gap-2 text-sm mb-3">
                            {moveBreadcrumbs.length > 1 && (
                                <button
                                    onClick={() => handleMoveBreadcrumbClick(moveBreadcrumbs.length - 2)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#333] text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm mr-1"
                                    title={t('back') || 'Go back one directory'}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180">
                                        <polyline points="15 18 9 12 15 6"></polyline>
                                    </svg>
                                    <span>{t('back') || 'Back'}</span>
                                </button>
                            )}
                            {moveBreadcrumbs.map((crumb, index) => (
                                <React.Fragment key={`${crumb.id || 'root'}-${index}`}>
                                    {index > 0 && <span className="text-gray-400">/</span>}
                                    <button
                                        onClick={() => handleMoveBreadcrumbClick(index)}
                                        className={`hover:underline ${index === moveBreadcrumbs.length - 1 ? 'font-semibold text-gray-900 dark:text-white' : 'text-blue-600 dark:text-blue-400'}`}
                                    >
                                        {crumb.name}
                                    </button>
                                </React.Fragment>
                            ))}
                            {isMoveFoldersRefreshing && (
                                <div className="ml-auto flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <Spinner size="sm" />
                                    <span>{t('loadingFolders') || 'Loading subfolders...'}</span>
                                </div>
                            )}
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex-1 overflow-y-auto min-h-[220px]">
                            <button
                                onClick={() => setTargetMoveFolderId(moveCurrentFolderId)}
                                className={`w-full text-left px-3 py-2 rounded-md mb-2 border ${targetMoveFolderId === moveCurrentFolderId ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                    {t('selectCurrentFolder') || 'Select this folder'}
                                </div>
                            </button>

                            {isMoveFoldersInitialLoading ? (
                                <div className="py-6 flex items-center justify-center">
                                    <Spinner size="md" label={t('loadingFolders') || 'Loading subfolders...'} />
                                </div>
                            ) : moveFolderItems.length === 0 ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{t('noSubfolders') || 'No subfolders here'}</div>
                            ) : (
                                <div className="space-y-1">
                                    {moveFolderItems.map((folder) => (
                                        <div key={folder.id} className="flex items-center gap-2">
                                            <button
                                                onClick={() => setTargetMoveFolderId(folder.id)}
                                                onDoubleClick={() => handleMoveModalNavigate(folder)}
                                                className={`flex-1 text-left px-3 py-2 rounded-md border ${targetMoveFolderId === folder.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                            >
                                                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{folder.name}</div>
                                            </button>
                                            <button
                                                onClick={() => handleMoveModalNavigate(folder)}
                                                className="px-2 py-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                title={t('openFolder') || 'Open folder'}
                                            >
                                                <Image src="/icons/chevron-right.svg" width={16} height={16} className="dark:invert" alt="" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex justify-end gap-3">
                            <button
                                onClick={closeMoveModal}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                {t('cancel') || 'Cancel'}
                            </button>
                            <LoadingButton
                                onClick={async () => {
                                    await moveFilesToFolder(moveItemIds, targetMoveFolderId);
                                    closeMoveModal();
                                }}
                                isLoading={isBatchMoving}
                                loadingText={t('moving') || 'Moving...'}
                                disabled={moveItemIds.length === 0}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
                            >
                                {t('moveHere') || 'Move here'}
                            </LoadingButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Drag-and-drop move confirmation dialog */}
            {pendingMoveConfirm && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-[90] p-4 animate-fade-in"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setPendingMoveConfirm(null);
                    }}
                >
                    <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-950/40">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center">
                                <Image src="/folder.svg" alt="" width={22} height={22} className="dark:invert" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{t('moveItemsTitle') || 'Move Items'}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('confirmBeforeMoving') || 'Confirm before moving'}</p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5">
                            {/* Count pill */}
                            <div className="flex items-center gap-2 mb-4">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    {pendingMoveConfirm.fileIds.length} {pendingMoveConfirm.fileIds.length === 1 ? (t('itemWord') || 'item') : (t('itemsWord') || 'items')}
                                </span>
                                <svg className="text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                                    <Image src="/folder.svg" alt="" width={12} height={12} className="opacity-70" />
                                    {pendingMoveConfirm.destination.name}
                                </span>
                            </div>

                            {/* Item name previews */}
                            <div className="bg-gray-50 dark:bg-[#333] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
                                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('itemsToMove') || 'Items to move'}</p>
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700/60 max-h-44 overflow-y-auto">
                                    {pendingMoveConfirm.fileIds.slice(0, 8).map((id) => {
                                        const it = items.find((x) => x.id === id);
                                        return it ? (
                                            <div key={id} className="flex items-center gap-2.5 px-3 py-2">
                                                <div className="flex-shrink-0 opacity-60">
                                                    {renderIcon(it, false)}
                                                </div>
                                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{it.name}</span>
                                            </div>
                                        ) : null;
                                    })}
                                    {pendingMoveConfirm.fileIds.length > 8 && (
                                        <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
                                            + {pendingMoveConfirm.fileIds.length - 8} {t('itemsWord') || 'more items'}…
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('confirmMoveItems')
                                    ?.replace('{count}', String(pendingMoveConfirm.fileIds.length))
                                    ?.replace('{itemWord}', pendingMoveConfirm.fileIds.length === 1 ? (t('itemWord') || 'item') : (t('itemsWord') || 'items'))
                                    || `Are you sure you want to move ${pendingMoveConfirm.fileIds.length} ${pendingMoveConfirm.fileIds.length === 1 ? 'item' : 'items'} into`}
                                {' '}
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                    &ldquo;{pendingMoveConfirm.destination.name}&rdquo;
                                </span>?
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-[#252525]/60">
                            <button
                                onClick={() => setPendingMoveConfirm(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#333] border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-[#3a3a3a] transition-colors"
                            >
                                {t('cancel') || 'Cancel'}
                            </button>
                            <LoadingButton
                                onClick={async () => {
                                    const { fileIds, destination } = pendingMoveConfirm;
                                    setPendingMoveConfirm(null);
                                    await moveFilesToFolder(fileIds, destination.id);
                                }}
                                isLoading={isBatchMoving}
                                loadingText={t('moving') || 'Moving…'}
                                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                                {t('yesMove') || 'Yes, Move'}
                            </LoadingButton>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch delete confirmation dialog */}
            {batchDeleteConfirmOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-[90] p-4 animate-fade-in"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setBatchDeleteConfirmOpen(false);
                    }}
                >
                    <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-red-50 dark:bg-red-950/40">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/60 flex items-center justify-center">
                                <Image src="/icons/trash.svg" alt="" width={22} height={22} className="dark:invert" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{t('deleteItems') || 'Delete Items'}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('deleteItemsSubtitle') || 'This action cannot be undone'}</p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5">
                            <div className="flex items-center gap-2 mb-5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                                    <Image src="/icons/trash.svg" alt="" width={12} height={12} className="opacity-70 dark:invert" />
                                    {selectedFileCount} {selectedFileCount === 1 ? (t('itemWord') || 'item') : (t('itemsWord') || 'items')}
                                </span>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('confirmDeleteMultipleItems')
                                    ?.replace('{count}', String(selectedFileCount))
                                    ?.replace('{itemWord}', selectedFileCount === 1 ? (t('itemWord') || 'item') : (t('itemsWord') || 'items'))
                                    || `Are you sure you want to delete ${selectedFileCount} selected ${selectedFileCount === 1 ? 'item' : 'items'}? This cannot be undone.`}
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-[#252525]/60">
                            <button
                                onClick={() => setBatchDeleteConfirmOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#333] border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-[#3a3a3a] transition-colors"
                            >
                                {t('cancel') || 'Cancel'}
                            </button>
                            <LoadingButton
                                onClick={executeBatchDelete}
                                isLoading={isBatchDeleting}
                                loadingText={t('deleting') || 'Deleting…'}
                                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                            >
                                <Image src="/icons/trash.svg" alt="" width={14} height={14} className="dark:invert" />
                                {t('yesDelete') || 'Yes, Delete'}
                            </LoadingButton>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
};