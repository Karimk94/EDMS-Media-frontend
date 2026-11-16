export class Document {
    doc_id: number;
    title: string;
    abstract?: string;
    docnumber: string;
    docname: string;
    date: string;
    thumbnail_url: string;
    media_type: 'image' | 'video' | 'pdf' | 'text' | 'file' | 'excel' | 'powerpoint' | 'word' | 'zip' | 'audio' | 'cad' | 'code' | 'email' | 'font' | 'database' | 'vector' | 'archive' | 'executable' | 'disc' | 'visio' | 'onenote';
    tags?: string[];
    is_favorite?: boolean;
    // Document relationship (original vs edited)
    has_original?: boolean;
    original_docnumber?: number;
    original_docname?: string;
    is_original?: boolean;
    edited_docnumber?: number;
    edited_docname?: string;
    // Search context metadata
    searchMatchField?: string; // Field where the search term was found
    searchMatchValue?: string; // The value that was searched for
    searchFieldValue?: string; // The actual value from the matched field
    // Event/Folder context - populated when document found via event search
    event_name?: string; // The event/folder name this document was found in

    constructor(data: Partial<Document>) {
        this.doc_id = data.doc_id || 0;
        this.title = data.title || '';
        this.abstract = data.abstract;
        this.docnumber = data.docnumber || '';
        this.docname = data.docname || '';
        this.date = data.date || '';
        this.thumbnail_url = data.thumbnail_url || '';
        this.media_type = data.media_type || 'image';
        this.tags = data.tags;
        this.is_favorite = data.is_favorite;
        this.has_original = data.has_original;
        this.original_docnumber = data.original_docnumber;
        this.original_docname = data.original_docname;
        this.is_original = data.is_original;
        this.edited_docnumber = data.edited_docnumber;
        this.edited_docname = data.edited_docname;
        const rawData = data as Partial<Document> & {
            search_match_field?: string;
            search_match_value?: string;
            search_field_value?: string;
        };
        this.searchMatchField = data.searchMatchField || rawData.search_match_field;
        this.searchMatchValue = data.searchMatchValue || rawData.search_match_value;
        this.searchFieldValue = data.searchFieldValue || rawData.search_field_value;
        this.event_name = data.event_name;
    }
}
