export class User {
    username: string;
    security_level: 'Editor' | 'Viewer';
    lang?: 'en' | 'ar';
    theme?: 'light' | 'dark';

    constructor(data: Partial<User>) {
        this.username = data.username || '';
        this.security_level = data.security_level || 'Viewer';
        this.lang = data.lang;
        this.theme = data.theme;
    }
}
