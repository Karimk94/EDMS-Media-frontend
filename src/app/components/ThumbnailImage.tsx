import React, { useEffect, useRef, useState, useCallback } from 'react';

interface ThumbnailImageProps {
    /** Base thumbnail URL (without any cache-busting query param). */
    src: string;
    alt: string;
    /** Tailwind/CSS classes for the <img>. */
    className?: string;
    /** Fallback image source shown after all retries are exhausted. */
    fallbackSrc?: string;
    /** Tailwind/CSS classes applied to the <img> once it falls back. */
    fallbackClassName?: string;
    /** Optional cache-busting query value appended as ?v=<key>. Only set this
     *  for thumbnails that are known to have changed (e.g. after processing). */
    refreshKey?: number;
    /** Max number of retry attempts on error (default 3). */
    maxRetries?: number;
    /** Base delay in ms for exponential backoff (default 800). */
    baseDelayMs?: number;
    /** Wrapper style width/height are inherited from className; this is for
     *  cases where the parent sets an explicit pixel size. */
    style?: React.CSSProperties;
}

/**
 * Thumbnail image with automatic retry-on-error (exponential backoff) and a
 * graceful SVG fallback.
 *
 * Why this exists: the Folders section previously rendered thumbnails via a
 * plain <img> whose onError handler permanently swapped to a static SVG. When
 * the backend had not yet generated a thumbnail (404), the image stayed
 * "missing" until a manual page refresh. Now the backend generates thumbnails
 * on-demand on the first /cache/{id}.jpg request, which can take a second or
 * two. This component transparently retries the same URL a few times so the
 * thumbnail appears as soon as it is ready — no manual refresh needed.
 */
export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({
    src,
    alt,
    className = '',
    fallbackSrc = '/file-image.svg',
    fallbackClassName = 'w-full h-full object-contain',
    refreshKey = 0,
    maxRetries = 3,
    baseDelayMs = 800,
    style,
}) => {
    const cacheSuffix = refreshKey > 0 ? `?v=${refreshKey}` : '';
    const fullSrc = `${src}${cacheSuffix}`;

    // attempt = -1 means "using fallback". 0..maxRetries are retry attempts.
    const [attempt, setAttempt] = useState(0);
    const [usingFallback, setUsingFallback] = useState(false);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Keep the mounted flag to avoid setState after unmount.
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (retryTimer.current) clearTimeout(retryTimer.current);
        };
    }, []);

    // Reset attempt state whenever the source changes (new doc / new refresh key).
    useEffect(() => {
        setAttempt(0);
        setUsingFallback(false);
    }, [fullSrc]);

    const handleError = useCallback(() => {
        if (!mountedRef.current) return;
        if (attempt < maxRetries) {
            // Exponential backoff: baseDelayMs * 2^attempt
            const delay = baseDelayMs * Math.pow(2, attempt);
            if (retryTimer.current) clearTimeout(retryTimer.current);
            retryTimer.current = setTimeout(() => {
                if (!mountedRef.current) return;
                setAttempt((a) => a + 1);
            }, delay);
        } else {
            // Exhausted retries -> show fallback permanently for this src.
            setUsingFallback(true);
        }
    }, [attempt, maxRetries, baseDelayMs]);

    // Force a re-request by appending a unique retry param on each attempt.
    // (The backend caches the file after first generation, so retrying the
    // bare URL would also work, but the cache-buster guarantees the browser
    // actually re-issues the request rather than serving a cached 404.)
    const retrySuffix = attempt > 0 ? `${cacheSuffix ? '&' : '?'}retry=${attempt}` : '';
    const finalSrc = usingFallback ? fallbackSrc : `${fullSrc}${retrySuffix}`;

    return (
        <img
            src={finalSrc}
            alt={alt}
            loading="lazy"
            decoding="async"
            className={usingFallback ? fallbackClassName : className}
            style={style}
            onError={handleError}
        />
    );
};
