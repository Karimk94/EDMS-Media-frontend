import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { FolderItem } from './useFolderContents';
import { PersonOption } from '../models/PersonOption';

/**
 * A document returned by the global /api/documents endpoint, converted into a
 * FolderItem so it can be rendered alongside folder-name search matches.
 */
interface DocumentsResponseItem {
    doc_id: number;
    docnumber?: string;
    title?: string;
    abstract?: string;
    docname?: string;
    date?: string;
    thumbnail_url?: string;
    media_type?: string;
    event_name?: string;
}

const formatToApiDateTime = (date: Date | null): string => {
    if (!date) return '';
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
        date.getSeconds()
    )}`;
};

interface UseFolderContentSearchParams {
    searchTerm: string;
    apiURL: string;
    page: number;
    pageSize: number;
    /** Media-type filter for the standard folders (images/videos/files). */
    mediaType?: 'image' | 'video' | 'pdf' | null;
    /** UI language — controls Arabic/English tag & person column selection on the backend. */
    lang?: 'en' | 'ar';
    isEnabled?: boolean;
    selectedTags?: string[];
    selectedYears?: number[];
    dateFrom?: Date | null;
    dateTo?: Date | null;
    selectedPerson?: PersonOption[] | null;
    personCondition?: 'any' | 'all';
}

interface FolderContentSearchResponse {
    /** Content/embedding-matched files, converted to FolderItem shape. */
    contents: FolderItem[];
    total_pages: number;
    total_documents: number;
    search_meta?: {
        tokens: string[];
        required_concepts: string[];
    };
}

/**
 * Performs the "global" content + embedding search scoped to the folder
 * hierarchy. This reuses the existing /api/documents endpoint which already
 * combines SQL text search (abstract, docname, tags, persons, dates) with
 * vector/embedding semantic search (ChromaDB) — exactly the same engine that
 * powers the Recents tab search.
 *
 * The results are converted to FolderItem objects so the Folders UI can render
 * them uniformly alongside the folder-name matches from useFolderContents.
 */
export function useFolderContentSearch({
    searchTerm,
    apiURL = '/api',
    page = 1,
    pageSize = 20,
    mediaType = null,
    lang = 'en',
    isEnabled = true,
    selectedTags = [],
    selectedYears = [],
    dateFrom = null,
    dateTo = null,
    selectedPerson = null,
    personCondition = 'any',
}: UseFolderContentSearchParams) {
    const hasFilters = Boolean(
        (selectedTags && selectedTags.length > 0) ||
        (selectedYears && selectedYears.length > 0) ||
        dateFrom ||
        dateTo ||
        (selectedPerson && selectedPerson.length > 0) ||
        mediaType
    );

    return useQuery({
        queryKey: [
            'folder-content-search',
            searchTerm,
            page,
            pageSize,
            mediaType,
            lang,
            JSON.stringify(selectedTags || []),
            JSON.stringify(selectedYears || []),
            dateFrom ? dateFrom.toISOString() : null,
            dateTo ? dateTo.toISOString() : null,
            JSON.stringify(selectedPerson || []),
            personCondition,
        ],
        queryFn: async ({ signal }): Promise<FolderContentSearchResponse> => {
            if (!searchTerm && !hasFilters) {
                return { contents: [], total_pages: 1, total_documents: 0 };
            }

            const params = new URLSearchParams();
            params.append('page', String(page));
            params.append('pageSize', String(pageSize));
            params.append('scope', 'folders');
            params.append('lang', lang);

            if (searchTerm) params.append('search', searchTerm);
            if (mediaType) params.append('media_type', mediaType);

            if (selectedPerson && selectedPerson.length > 0) {
                const personNames = selectedPerson
                    .map((p) => {
                        const parts = p.label.split(' - ');
                        if (lang === 'ar' && parts.length > 1) {
                            return parts[parts.length - 1].trim();
                        }
                        return parts[0].trim();
                    })
                    .join(',');
                params.append('persons', personNames);
                if (selectedPerson.length > 1 && personCondition) {
                    params.append('person_condition', personCondition);
                }
            }

            if (selectedTags && selectedTags.length > 0) {
                params.append('tags', selectedTags.join(','));
            }
            if (dateFrom) {
                const formattedDateFrom = formatToApiDateTime(dateFrom);
                if (formattedDateFrom) params.append('date_from', formattedDateFrom);
            }
            if (dateTo) {
                const formattedDateTo = formatToApiDateTime(dateTo);
                if (formattedDateTo) params.append('date_to', formattedDateTo);
            }
            if (selectedYears && selectedYears.length > 0) {
                params.append('years', selectedYears.join(','));
            }

            const data = await apiClient.get<{
                documents: DocumentsResponseItem[];
                total_pages?: number;
                total_documents?: number;
                search_meta?: {
                    tokens: string[];
                    required_concepts: string[];
                };
            }>(`${apiURL}/documents?${params.toString()}`, { signal });

            const contents: FolderItem[] = (data.documents || []).map((doc) => ({
                id: doc.doc_id,
                system_id: String(doc.doc_id),
                name: doc.docname || doc.title || `Document ${doc.doc_id}`,
                type: 'file' as const,
                media_type: (doc.media_type as FolderItem['media_type']) || 'file',
                date: doc.date,
                thumbnail_url: doc.thumbnail_url,
                is_standard: false,
                event_name: doc.event_name,
                // Preserve the original document fields so the modal opened on
                // click can show the correct title (docname) and abstract
                // instead of collapsing them into a single `name` value.
                title: doc.title,
                abstract: doc.abstract,
                docname: doc.docname,
            } as FolderItem & { title?: string; abstract?: string; docname?: string }));

            return {
                contents,
                total_pages: data.total_pages || 1,
                total_documents: data.total_documents || 0,
                search_meta: data.search_meta
            };
        },
        enabled: isEnabled && (!!searchTerm || hasFilters),
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60, // 1 minute
    });
}
