import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Document } from '../models/Document';
import { PersonOption } from '../models/PersonOption';
import { apiClient } from '../lib/apiClient';

type ActiveSection = 'recent' | 'favorites' | 'folders' | 'profilesearch';

interface UseDocumentsParams {
    activeSection: ActiveSection;
    activeFolder: 'images' | 'videos' | 'files' | null;
    currentPage: number;
    searchTerm: string;
    dateFrom: Date | null;
    dateTo: Date | null;
    selectedPerson: PersonOption[] | null;
    personCondition: 'any' | 'all';
    selectedTags: string[];
    selectedYears: number[];
    filterMediaType: 'image' | 'video' | 'pdf' | null;
    lang: 'en' | 'ar';
    isEnabled?: boolean;
}

interface DocumentsResponse {
    documents: Document[];
    total_pages: number;
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

export function useDocuments({
    activeSection,
    activeFolder,
    currentPage,
    searchTerm,
    dateFrom,
    dateTo,
    selectedPerson,
    personCondition,
    selectedTags,
    selectedYears,
    filterMediaType,
    lang,
    isEnabled = true
}: UseDocumentsParams) {
    return useQuery({
        queryKey: [
            'documents',
            activeSection,
            activeFolder,
            currentPage,
            searchTerm,
            dateFrom,
            dateTo,
            JSON.stringify(selectedPerson), // Serialize for stable key
            personCondition,
            selectedTags,
            selectedYears,
            filterMediaType,
            lang
        ],
        queryFn: async (): Promise<DocumentsResponse> => {
            // Folders section logic handled separately unless inside standard folders
            if (activeSection === 'folders' && !activeFolder) {
                return { documents: [], total_pages: 1 };
            }

            const params = new URLSearchParams();
            params.append('page', String(currentPage));
            params.append('pageSize', '20');
            params.append('lang', lang);

            if (searchTerm) params.append('search', searchTerm);
            if (selectedPerson && selectedPerson.length > 0) {
                const personNames = selectedPerson
                    .map((p) => p.label.split(' - ')[0])
                    .join(',');
                params.append('persons', personNames);
                if (selectedPerson.length > 1) {
                    params.append('person_condition', personCondition);
                }
            }
            if (selectedTags.length > 0) {
                params.append('tags', selectedTags.join(','));
            }
            const formattedDateFrom = formatToApiDateTime(dateFrom);
            if (formattedDateFrom) params.append('date_from', formattedDateFrom);
            const formattedDateTo = formatToApiDateTime(dateTo);
            if (formattedDateTo) params.append('date_to', formattedDateTo);
            if (selectedYears.length > 0) {
                params.append('years', selectedYears.join(','));
            }

            if (activeSection === 'folders' && activeFolder) {
                if (activeFolder === 'images') params.append('media_type', 'image');
                else if (activeFolder === 'videos') params.append('media_type', 'video');
                else if (activeFolder === 'files') params.append('media_type', 'pdf');
                params.append('scope', 'folders');
            } else if (filterMediaType) {
                params.append('media_type', filterMediaType);
            }

            let endpoint = '';
            let dataKey = 'documents';
            if (activeSection === 'profilesearch') {
                return { documents: [], total_pages: 1 };
            }

            switch (activeSection) {
                case 'recent':
                    endpoint = '/api/documents';
                    params.append('sort', 'date_desc');
                    break;
                case 'favorites':
                    endpoint = '/api/favorites';
                    break;
                case 'folders':
                    if (activeFolder) {
                        endpoint = '/api/documents';
                    }
                    break;
                default:
                    throw new Error(`Invalid section: ${activeSection}`);
            }

            if (!endpoint) return { documents: [], total_pages: 1 };

            const data = await apiClient.get(`${endpoint}?${params.toString()}`);
            let fetchedDocs = data[dataKey] || [];

            // Client-side filtering for folders (mirrors existing logic)
            if (activeSection === 'folders' && activeFolder) {
                fetchedDocs = fetchedDocs.filter((doc: Document) => {
                    if (activeFolder === 'images') return doc.media_type === 'image';
                    if (activeFolder === 'videos') return doc.media_type === 'video';
                    if (activeFolder === 'files') return doc.media_type === 'pdf';
                    return true;
                });
            }

            return {
                documents: fetchedDocs,
                total_pages: data.total_pages || 1
            };
        },
        enabled: isEnabled && (activeSection !== 'folders' || !!activeFolder),
        placeholderData: keepPreviousData, // Keep data while fetching new page
        staleTime: 1000 * 60, // 1 minute
    });
}
