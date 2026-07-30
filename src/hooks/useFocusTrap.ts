import { useCallback, useEffect, useRef } from 'react';

/**
 * Traps keyboard focus within a modal container.
 * - Tab / Shift+Tab cycles through focusable elements inside the ref
 * - Escape calls onClose
 * - Auto-focuses the first focusable element on mount
 *
 * Usage: <div ref={useFocusTrap(onClose)}> ... </div>
 */
export function useFocusTrap(onClose: () => void) {
    const ref = useRef<HTMLDivElement>(null);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }

            if (e.key !== 'Tab') return;

            const container = ref.current;
            if (!container) return;

            const focusable = container.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                // Shift+Tab — if on first element, wrap to last
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                // Tab — if on last element, wrap to first
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        },
        [onClose]
    );

    useEffect(() => {
        const container = ref.current;
        if (!container) return;

        // Auto-focus first focusable element
        const focusable = container.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
            // Slight delay to allow the modal to render
            requestAnimationFrame(() => focusable[0].focus());
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return ref;
}
