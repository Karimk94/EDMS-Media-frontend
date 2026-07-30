/**
 * Toast event bridge — connects providers.tsx (outside ToastProvider)
 * to ToastContext (inside ToastProvider) via a simple pub/sub.
 */

type ToastType = 'success' | 'error' | 'info' | 'warning';
type ToastListener = (message: string, type: ToastType) => void;

const listeners: Set<ToastListener> = new Set();

/** Emit a toast event (called from providers.tsx mutation onError) */
export function emitToast(message: string, type: ToastType = 'error') {
    listeners.forEach(fn => fn(message, type));
}

/** Subscribe to toast events (called from ToastContext) */
export function onToast(listener: ToastListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
