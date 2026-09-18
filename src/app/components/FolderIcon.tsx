import React from 'react';
import Image from 'next/image';
import { useFolderPreviews } from '../../hooks/useFolderPreviews';

import { FolderItem } from '../../hooks/useFolderContents';
interface FolderIconProps {
    item: FolderItem;
    apiURL: string;
    isStandard?: boolean;
    renderDefaultIcon: (item: FolderItem, isStandard?: boolean) => React.ReactNode;
}

export const FolderIcon: React.FC<FolderIconProps> = ({ item, apiURL, isStandard = false, renderDefaultIcon }) => {
    const { data: previewIds } = useFolderPreviews(item.id, apiURL, isStandard || item.type !== 'folder');

    if (!previewIds || previewIds.length === 0) {
        return <>{renderDefaultIcon(item, isStandard)}</>;
    }

    // Grid of up to 4 thumbnails
    const displayIds = previewIds.slice(0, 4);
    
    return (
        <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5 border-2 border-white dark:border-gray-600 shadow-sm relative">
            {displayIds.map((id, index) => (
                <div key={id} className="relative w-full h-full bg-gray-300 dark:bg-gray-600">
                    <Image
                        src={`${apiURL}/cache/${id}.jpg`}
                        alt={`Preview ${index}`}
                        fill
                        className="object-cover"
                        sizes="28px"
                        unoptimized={true}
                    />
                </div>
            ))}
            {/* Fill empty spots if less than 4 */}
            {Array.from({ length: Math.max(0, 4 - displayIds.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="w-full h-full bg-gray-200 dark:bg-gray-700"></div>
            ))}
            {/* Subtle folder overlay icon */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                <Image src="/folder-icon.svg" alt="Folder" width={24} height={24} className="invert opacity-75" />
            </div>
        </div>
    );
};
