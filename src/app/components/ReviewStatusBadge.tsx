import React from 'react';
import Image from 'next/image';

interface ReviewStatusBadgeProps {
    status: 'pending' | 'ready_for_review' | 'verified';
    t: any;
    absolute?: boolean;
}

export const ReviewStatusBadge: React.FC<ReviewStatusBadgeProps> = ({ status, t, absolute = true }) => {
    // Not analysed yet -> yellow hourglass (sand timer clock)
    let bgColor = 'bg-yellow-100 dark:bg-yellow-900/30';
    let iconSrc = '/icons/status-pending.svg';
    let label = t('statusPending') || 'Not Analysed Yet';

    if (status === 'ready_for_review') {
        // Ready for verification -> orange magnifying glass
        bgColor = 'bg-orange-100 dark:bg-orange-900/30';
        iconSrc = '/icons/status-ready.svg';
        label = t('statusReady') || 'Ready to Verify';
    } else if (status === 'verified') {
        // Completed -> green check
        bgColor = 'bg-green-100 dark:bg-green-900/30';
        iconSrc = '/icons/status-completed.svg';
        label = t('statusVerified') || 'Completed';
    }

    const positionClass = absolute ? 'absolute top-2 right-2' : '';

    return (
        <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${bgColor} ${positionClass} z-10 shadow-sm border border-white/20`}
            title={label}
        >
            <Image
                src={iconSrc}
                alt={label}
                width={16}
                height={16}
                className="w-4 h-4"
            />
        </span>
    );
};
