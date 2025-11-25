export class EventItem {
    id: number;
    name: string;
    thumbnail_urls: string[];

    constructor(data: Partial<EventItem>) {
        this.id = data.id || 0;
        this.name = data.name || '';
        this.thumbnail_urls = data.thumbnail_urls || [];
    }
}
