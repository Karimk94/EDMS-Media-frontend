export class PersonOption {
    value: string;
    label: string;

    constructor(data: Partial<PersonOption>) {
        this.value = data.value || '';
        this.label = data.label || '';
    }
}
