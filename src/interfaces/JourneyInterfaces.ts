export interface JourneyEvent {
    title: string;
    thumbnail: string;
    gallery: string[];
}

export interface JourneyData {
    [year: string]: JourneyEvent[];
}
