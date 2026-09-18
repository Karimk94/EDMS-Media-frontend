/**
 * Centralized API client with:
 * - Auto 401 → redirect to /login
 * - Consistent error extraction from API responses
 * - Default credentials: 'include'
 * - Automatic retry with exponential backoff for transient failures
 * - AbortSignal support for request cancellation
 */

export class ApiError extends Error {
    status: number;
    data: any;

    constructor(message: string, status: number, data?: any) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

// --- Retry Configuration ---

/** HTTP status codes that are safe to retry (transient server/network errors) */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/** Default retry counts by HTTP method */
const DEFAULT_RETRIES: Record<string, number> = {
    GET: 3,
    HEAD: 3,
    OPTIONS: 3,
    POST: 1,
    PUT: 1,
    DELETE: 1,
    PATCH: 1,
};

/** Base delay in ms for exponential backoff (300ms → 600ms → 1200ms → ...) */
const BASE_DELAY_MS = 300;

/** Maximum delay cap in ms */
const MAX_DELAY_MS = 5000;

/**
 * Determines whether a failed request should be retried.
 * Retries on network errors and specific 5xx/transient status codes.
 * Never retries on 4xx client errors (except 408 and 429).
 */
function isRetryable(error: unknown): boolean {
    // Network failure (no response at all)
    if (error instanceof TypeError && error.message.includes('fetch')) {
        return true;
    }

    // ApiError with a retryable status code
    if (error instanceof ApiError) {
        return RETRYABLE_STATUS_CODES.has(error.status);
    }

    return false;
}

/**
 * Calculates the delay before the next retry attempt.
 * Respects Retry-After header for 429 responses.
 * Uses exponential backoff with jitter for other errors.
 */
function getRetryDelay(attempt: number, error?: unknown): number {
    // Respect Retry-After for 429 Too Many Requests
    if (error instanceof ApiError && error.status === 429 && error.data?.retryAfter) {
        const retryAfter = Number(error.data.retryAfter);
        if (!isNaN(retryAfter) && retryAfter > 0) {
            return Math.min(retryAfter * 1000, MAX_DELAY_MS);
        }
    }

    // Exponential backoff with jitter: base * 2^attempt + random(0-100ms)
    const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt);
    const jitter = Math.random() * 100;
    return Math.min(exponentialDelay + jitter, MAX_DELAY_MS);
}

/**
 * Wraps a fetch call with automatic retry and exponential backoff.
 */
async function fetchWithRetry<T>(
    fetchFn: () => Promise<T>,
    method: string = 'GET',
    maxRetries?: number
): Promise<T> {
    const retries = maxRetries ?? DEFAULT_RETRIES[method.toUpperCase()] ?? 1;

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fetchFn();
        } catch (error) {
            lastError = error;

            // Don't retry if the request was intentionally aborted
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw error;
            }

            // Don't retry non-retryable errors (4xx client errors, etc.)
            if (!isRetryable(error)) {
                throw error;
            }

            // Don't retry if we've exhausted all attempts
            if (attempt >= retries) {
                throw error;
            }

            // Wait before retrying
            const delay = getRetryDelay(attempt, error);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError;
}

// --- Response Handling ---

async function handleResponse(response: Response): Promise<any> {
    if (response.status === 401) {
        // Auto-redirect to login on 401
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            const path = window.location.pathname;
            const search = window.location.search;
            const redirectParam = (path === '/' && !search) ? '' : `?redirect=${encodeURIComponent(path + search)}`;
            window.location.href = `/login${redirectParam}`;
        }
        throw new ApiError('Unauthorized', 401);
    }

    if (!response.ok) {
        let data: any = {};
        try {
            data = await response.json();
        } catch {
            // Response body is not JSON
        }

        // Capture Retry-After header for 429 handling
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            if (retryAfter) {
                data.retryAfter = retryAfter;
            }
        }

        const message = data?.detail || data?.error || data?.message || `Request failed (${response.status})`;
        throw new ApiError(message, response.status, data);
    }

    // Handle empty responses (204 No Content, etc.)
    const contentType = response.headers.get('content-type');
    if (response.status === 204 || !contentType?.includes('application/json')) {
        return response;
    }

    return response.json();
}

// --- API Client ---

/** Default headers to include with all requests */
const DEFAULT_HEADERS: Record<string, string> = {
    'X-App-Source': 'edms-media',
};

export const apiClient = {
    async get<T = any>(url: string, options?: RequestInit): Promise<T> {
        return fetchWithRetry(async () => {
            const response = await fetch(url, {
                ...options,
                method: 'GET',
                credentials: 'include',
                headers: { ...DEFAULT_HEADERS, ...(options?.headers || {}) },
            });
            return handleResponse(response);
        }, 'GET');
    },

    async post<T = any>(url: string, body?: any, options?: RequestInit): Promise<T> {
        return fetchWithRetry(async () => {
            const isFormData = body instanceof FormData;
            const response = await fetch(url, {
                ...options,
                method: 'POST',
                credentials: 'include',
                headers: isFormData
                    ? { ...DEFAULT_HEADERS, ...(options?.headers || {}) }
                    : { 'Content-Type': 'application/json', ...DEFAULT_HEADERS, ...(options?.headers || {}) },
                body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
            });
            return handleResponse(response);
        }, 'POST');
    },

    async put<T = any>(url: string, body?: any, options?: RequestInit): Promise<T> {
        return fetchWithRetry(async () => {
            const response = await fetch(url, {
                ...options,
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...DEFAULT_HEADERS, ...(options?.headers || {}) },
                body: body ? JSON.stringify(body) : undefined,
            });
            return handleResponse(response);
        }, 'PUT');
    },

    async delete<T = any>(url: string, options?: RequestInit): Promise<T> {
        return fetchWithRetry(async () => {
            const response = await fetch(url, {
                ...options,
                method: 'DELETE',
                credentials: 'include',
                headers: { ...DEFAULT_HEADERS, ...(options?.headers || {}) },
            });
            return handleResponse(response);
        }, 'DELETE');
    },

    /**
     * Raw fetch with credentials — for blob/stream downloads where
     * we don't want JSON parsing. Still does 401 redirect and retries.
     */
    async raw(url: string, options?: RequestInit): Promise<Response> {
        return fetchWithRetry(async () => {
            const response = await fetch(url, {
                ...options,
                credentials: 'include',
                headers: { ...DEFAULT_HEADERS, ...(options?.headers || {}) },
            });
            if (response.status === 401) {
                if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                    const path = window.location.pathname;
                    const search = window.location.search;
                    const redirectParam = (path === '/' && !search) ? '' : `?redirect=${encodeURIComponent(path + search)}`;
                    window.location.href = `/login${redirectParam}`;
                }
                throw new ApiError('Unauthorized', 401);
            }
            if (!response.ok) {
                throw new ApiError(`Request failed (${response.status})`, response.status);
            }
            return response;
        }, options?.method || 'GET');
    },
};
