export class PersonOption {
    value: string;
    label: string;
    name_english?: string;
    name_arabic?: string;

    constructor(data: Partial<PersonOption>) {
        this.value = data.value || '';
        this.label = data.label || '';
        this.name_english = data.name_english;
        this.name_arabic = data.name_arabic;
    }
}
