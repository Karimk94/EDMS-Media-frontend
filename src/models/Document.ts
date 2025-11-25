export class Document {
    doc_id: number;
    title: string;
    abstract?: string;
    docnumber: string;
    docname: string;
    date: string;
    thumbnail_url: string;
    media_type: 'image' | 'video' | 'pdf';
    tags?: string[];
    is_favorite?: boolean;

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
    }
}
