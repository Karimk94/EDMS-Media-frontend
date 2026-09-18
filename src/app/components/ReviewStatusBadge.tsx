import React from 'react';

interface ReviewStatusBadgeProps {
    status: 'pending' | 'ready_for_review' | 'verified';
    t: any;
    absolute?: boolean;
}

export const ReviewStatusBadge: React.FC<ReviewStatusBadgeProps> = ({ status, t, absolute = true }) => {
    let bgColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    let label = t('statusPending') || 'Pending Analysis';

    if (status === 'ready_for_review') {
        bgColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
        label = t('statusReady') || 'Ready for Review';
    } else if (status === 'verified') {
        bgColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
        label = t('statusVerified') || 'Verified';
    }

    const positionClass = absolute ? 'absolute top-2 right-2' : '';

    return (
        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${bgColor} ${positionClass} z-10 shadow-sm border border-white/20 whitespace-nowrap`}>
            {label}
        </span>
    );
};
