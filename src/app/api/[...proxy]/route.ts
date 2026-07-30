import { NextRequest, NextResponse } from 'next/server';

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL;
const FACE_RECOG_URL = process.env.FACE_RECOG_URL;
const DEFAULT_PROXY_TIMEOUT_MS = Number(process.env.API_PROXY_TIMEOUT_MS || 30000);
const AUTH_PROXY_TIMEOUT_MS = Number(process.env.AUTH_PROXY_TIMEOUT_MS || 10000);

// --- Proxy Retry Configuration ---

/** Max retries for transient backend failures (502, 503, 504, network errors) */
const MAX_PROXY_RETRIES = 2;

/** Base delay between proxy retries (500ms → 1000ms) */
const PROXY_RETRY_BASE_DELAY_MS = 500;

/** Status codes that warrant a server-side proxy retry */
const PROXY_RETRYABLE_STATUSES = new Set([502, 503, 504]);

/** Routes that should get extended timeouts (uploads, AI processing) */
const LONG_TIMEOUT_ROUTES = ['/upload_document', '/analyze_image', '/add_face', '/recognize_faces', '/analyze_image_stream'];
const LONG_TIMEOUT_MS = 600000; // 10 minutes

/**
 * Determine the appropriate timeout for a given path.
 */
function getTimeoutForPath(path: string): number {
  if (path.startsWith('/auth/')) return AUTH_PROXY_TIMEOUT_MS;
  if (LONG_TIMEOUT_ROUTES.some(route => path.startsWith(route))) return LONG_TIMEOUT_MS;
  return DEFAULT_PROXY_TIMEOUT_MS;
}

/**
 * Perform a single fetch attempt to the backend with timeout.
 */
async function fetchBackend(
  targetUrl: string,
  method: string,
  headers: Headers,
  body: ReadableStream<Uint8Array> | null,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(targetUrl, {
      method,
      headers,
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
      cache: 'no-store',
      signal: controller.signal,
      // @ts-ignore
      duplex: 'half',
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if a backend response status is retryable.
 */
function isRetryableStatus(status: number): boolean {
  return PROXY_RETRYABLE_STATUSES.has(status);
}

/**
 * Determine whether a request can be safely retried.
 * Only GET/HEAD are retried by default. Non-idempotent methods (POST/PUT/DELETE)
 * are only retried on connection errors (no response received) to avoid duplicates.
 */
function canRetryRequest(method: string, error: unknown, response?: Response): boolean {
  // Always retry GET/HEAD on retryable status or network error
  if (method === 'GET' || method === 'HEAD') {
    if (response && isRetryableStatus(response.status)) return true;
    if (!response && isNetworkError(error)) return true;
    return false;
  }

  // For mutations: only retry on network errors (backend never received the request)
  // If we got a response (even 5xx), don't retry — the backend may have processed it
  if (!response && isNetworkError(error)) return true;

  return false;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;  // fetch network failure
  if (error instanceof Error && error.name === 'AbortError') return false; // timeout - don't classify as network error for retry decision
  return false;
}

async function proxyHandler(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname.replace('/api', '');
  const startTime = Date.now();

  const faceRecogRoutes = ['/analyze_image', '/add_face', '/recognize_faces', '/analyze_image_stream'];

  let targetApiBaseUrl;

  if (faceRecogRoutes.some(route => path.startsWith(route))) {
    targetApiBaseUrl = FACE_RECOG_URL;
  } else {
    targetApiBaseUrl = FLASK_API_URL;
  }

  if (!targetApiBaseUrl) {
    return NextResponse.json({ error: 'Target API URL is not configured on the server.' }, { status: 500 });
  }

  const finalPath = path.startsWith('/cache/') ? path : `/api${path}`;

  const targetUrl = `${targetApiBaseUrl}${finalPath}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.set('X-App-Source', 'edms-media');

  const timeoutMs = getTimeoutForPath(path);

  // --- Retry loop ---
  let lastError: unknown;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= MAX_PROXY_RETRIES; attempt++) {
    try {
      const response = await fetchBackend(
        targetUrl,
        req.method,
        headers,
        req.body,
        timeoutMs,
      );

      // Check if we should retry this response
      if (isRetryableStatus(response.status) && canRetryRequest(req.method, null, response) && attempt < MAX_PROXY_RETRIES) {
        lastResponse = response;
        const delay = PROXY_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[Proxy] ${req.method} ${path} returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_PROXY_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Process the response (success or non-retryable error)
      const duration = Date.now() - startTime;
      if (!response.ok) {
        console.warn(`[Proxy] ${req.method} ${path} → ${response.status} (${duration}ms)`);
      }

      const contentType = response.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");

      let responseBody = response.body;

      if (isJson && !response.ok) {
        const json = await response.json();

        if (json.detail && !json.error) {
          const errorMsg = typeof json.detail === 'string'
            ? json.detail
            : Array.isArray(json.detail)
              ? json.detail.map((e: any) => e.msg).join(", ")
              : JSON.stringify(json.detail);
          json.error = errorMsg;
        }
        responseBody = JSON.stringify(json) as any;
      } else if (!response.ok) {
        // Log the HTML or text error body from the backend (useful for IIS 500 errors)
        const textBody = await response.text();
        console.error(`[Proxy] 500 Error Text:`, textBody.substring(0, 1000));
        responseBody = textBody as any;
      }

      const newHeaders = new Headers(response.headers);
      newHeaders.delete('content-length');
      newHeaders.delete('content-encoding');

      return new NextResponse(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      lastError = error;

      // Timeout — don't retry (would just timeout again)
      if (error instanceof Error && error.name === 'AbortError') {
        const duration = Date.now() - startTime;
        console.error(`[Proxy] ${req.method} ${path} timed out after ${duration}ms`);
        return NextResponse.json(
          { error: `Backend request timed out after ${timeoutMs}ms.` },
          { status: 504 },
        );
      }

      // Network error — retry if allowed
      if (canRetryRequest(req.method, error) && attempt < MAX_PROXY_RETRIES) {
        const delay = PROXY_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[Proxy] ${req.method} ${path} network error, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_PROXY_RETRIES}):`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Exhausted retries or non-retryable error
      const duration = Date.now() - startTime;
      console.error(`[Proxy] ${req.method} ${path} failed after ${attempt + 1} attempt(s) (${duration}ms):`, error);
      return NextResponse.json({ error: 'Error forwarding request to the backend.' }, { status: 502 });
    }
  }

  // Exhausted all retries — return last known error
  const duration = Date.now() - startTime;
  console.error(`[Proxy] ${req.method} ${path} exhausted ${MAX_PROXY_RETRIES + 1} attempts (${duration}ms)`);

  if (lastResponse) {
    return NextResponse.json(
      { error: `Backend returned ${lastResponse.status} after ${MAX_PROXY_RETRIES + 1} attempts.` },
      { status: lastResponse.status },
    );
  }

  return NextResponse.json({ error: 'Error forwarding request to the backend.' }, { status: 502 });
}

export async function GET(req: NextRequest) {
  return proxyHandler(req);
}

export async function POST(req: NextRequest) {
  return proxyHandler(req);
}

export async function PUT(req: NextRequest) {
  return proxyHandler(req);
}

export async function DELETE(req: NextRequest) {
  return proxyHandler(req);
}
