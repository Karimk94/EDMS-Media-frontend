// Component Props Interfaces
// This file contains all React component prop interfaces used throughout the application

// Upload-related Props
export interface UploadModalProps {
    onClose: () => void;
    apiURL: string;
    onAnalyze: (uploadedFiles: any[]) => void;
    theme: 'light' | 'dark';
}

export interface UploadFileItemProps {
    uploadableFile: any;
    onRemove: () => void;
    onUpdateFileName: (id: string, newName: string) => void;
    onUpdateDateTaken: (id: string, newDate: Date | null) => void;
}

// Event-related Props
export interface EventStackProps {
    event: any;
    apiURL: string;
    onClick: (eventId: number) => void;
}

export interface EventEditorProps {
    docId?: number;
    apiURL: string;
    selectedEvent: any | null;
    setSelectedEvent: (event: any | null) => void;
    onEventChange?: (docId: number, eventId: number | null) => Promise<boolean>;
    theme: 'light' | 'dark';
}

export interface EventDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialEventId: number | null;
    initialEventName: string;
    apiURL: string;
    theme: 'light' | 'dark';
}

export interface ReadOnlyEventDisplayProps {
    event: any | null;
    t: Function;
}

// Modal Props
export interface ImageModalProps {
    doc: any;
    onClose: () => void;
    apiURL: string;
    onUpdateAbstractSuccess: () => void;
    onToggleFavorite: (docId: number, isFavorite: boolean) => void;
    isEditor: boolean;
    t: Function;
    lang: 'en' | 'ar';
    theme: 'light' | 'dark';
}

export interface VideoModalProps {
    doc: any;
    onClose: () => void;
    apiURL: string;
    onUpdateAbstractSuccess: () => void;
    onToggleFavorite: (docId: number, isFavorite: boolean) => void;
    isEditor: boolean;
    t: Function;
    lang: 'en' | 'ar';
    theme: 'light' | 'dark';
}

export interface PdfModalProps {
    doc: any;
    onClose: () => void;
    apiURL: string;
    onUpdateAbstractSuccess: () => void;
    onToggleFavorite: (docId: number, isFavorite: boolean) => void;
    isEditor: boolean;
    t: Function;
    lang: 'en' | 'ar';
    theme: 'light' | 'dark';
}

export interface GalleryModalProps {
    title: string;
    images: string[];
    startIndex: number;
    onClose: () => void;
}

// Tag-related Props
export interface TagEditorProps {
    docId: number;
    apiURL: string;
    lang: 'en' | 'ar';
    theme: 'light' | 'dark';
    t: Function;
}

export interface TagFilterProps {
    apiURL: string;
    selectedTags: string[];
    setSelectedTags: (tags: string[]) => void;
    t: Function;
    lang: 'en' | 'ar';
}

export interface ReadOnlyTagDisplayProps {
    docId: number;
    apiURL: string;
    lang: 'en' | 'ar';
    t: Function;
}

// Filter Props
export interface YearFilterProps {
    selectedYears: number[];
    setSelectedYears: (years: number[]) => void;
    t: Function;
}

export interface DateRangePickerProps {
    dateFrom: string;
    setDateFrom: (date: string) => void;
    dateTo: string;
    setDateTo: (date: string) => void;
}

export interface AdvancedFiltersProps {
    dateFrom: string;
    setDateFrom: (date: string) => void;
    dateTo: string;
    setDateTo: (date: string) => void;
    selectedYears: number[];
    setSelectedYears: (years: number[]) => void;
    selectedTags: string[];
    setSelectedTags: (tags: string[]) => void;
    selectedPerson: string | null;
    setSelectedPerson: (person: string | null) => void;
    t: Function;
    apiURL: string;
    lang: 'en' | 'ar';
    theme: 'light' | 'dark';
}

// Document-related Props
export interface DocumentListProps {
    documents: any[];
    onDocumentClick: (doc: any) => void;
    apiURL: string;
    onTagSelect: (tag: string) => void;
    isLoading: boolean;
    processingDocs: number[];
    onToggleFavorite: (docId: number, isFavorite: boolean) => void;
    lang: 'en' | 'ar';
}

export interface DocumentItemProps {
    doc: any;
    onDocumentClick: (doc: any) => void;
    apiURL: string;
    onTagSelect: (tag: string) => void;
    isProcessing: boolean;
    onToggleFavorite: (docId: number, isFavorite: boolean) => void;
    lang: 'en' | 'ar';
}

// Journey Props
export interface JourneyProps {
    apiURL: string;
    t: Function;
}

// Pagination Props
export interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    t: Function;
}

// Person Selector Props
export interface PersonSelectorProps {
    apiURL: string;
    value: string | null;
    onChange: (value: string) => void;
    lang: 'en' | 'ar';
    theme: 'light' | 'dark';
}

// Header and Sidebar Props
export interface HeaderProps {
    onSearch: (searchTerm: string) => void;
    onClearCache: () => void;
    lang: 'en' | 'ar';
    setLang: (lang: 'en' | 'ar') => void;
    theme: 'light' | 'dark';
    onThemeChange: (theme: 'light' | 'dark') => void;
    t: Function;
    apiURL: string;
    onOpenUploadModal: () => void;
    isProcessing: boolean;
    onLogout: () => void;
    isEditor: boolean;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
}

export interface SidebarProps {
    isSidebarOpen: boolean;
    activeSection: 'recent' | 'favorites' | 'events' | 'memories' | 'journey';
    handleSectionChange: (section: 'recent' | 'favorites' | 'events' | 'memories' | 'journey') => void;
    isShowingFullMemories: boolean;
    t: Function;
    lang: 'en' | 'ar';
}

// Search Props
export interface SearchBarProps {
    onSearch: (searchTerm: string) => void;
    t: Function;
    lang: 'en' | 'ar';
}

// Utility Props
export interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    theme: 'light' | 'dark';
}

export interface HtmlThemeUpdaterProps {
    theme: 'light' | 'dark';
}

export interface HtmlLangUpdaterProps {
    lang: 'en' | 'ar';
}

export interface MemoriesStackProps {
    memories: any[];
    apiURL: string;
    onClick: () => void;
}

export interface AnalysisViewProps {
    result: any;
    docId: number;
    apiURL: string;
    onUpdateAbstractSuccess: () => void;
    lang: 'en' | 'ar';
    theme: 'light' | 'dark';
}
