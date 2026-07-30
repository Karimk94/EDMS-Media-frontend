export class User {
    username: string;
    security_level: 'Editor' | 'Viewer';
    lang?: 'en' | 'ar';
    theme: 'light' | 'dark';
    remaining_quota?: number;
    quota?: number;

    constructor(data: Partial<User>) {
        this.username = data.username || '';
        this.security_level = data.security_level || 'Viewer';
        this.lang = data.lang;
        this.theme = data.theme || 'light'; // Assuming a default for the now non-optional 'theme'
        this.remaining_quota = data.remaining_quota;
        this.quota = data.quota;
    }
}
