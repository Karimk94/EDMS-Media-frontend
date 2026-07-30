import React from 'react';

import { ReadOnlyTagDisplayProps } from '../../interfaces/PropsInterfaces';
import { useTags } from '../../hooks/useTags';

export const ReadOnlyTagDisplay: React.FC<ReadOnlyTagDisplayProps> = ({ docId, apiURL, lang, t }) => {
  // Use the new hook
  const { documentTags: tags, isLoadingDocumentTags: isLoading } = useTags({ lang, docId });

  return (
    <div className="mt-4">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('tags')}</h4>
      {isLoading ? <p className="text-sm text-gray-500">{t('LoadingTags')}...</p> : (
        <div className="flex flex-wrap gap-2 mb-3 bg-gray-100 dark:bg-[#121212] p-2 rounded-md min-h-[40px]">
          {tags.length > 0 ? tags.map((tag, index) => (
            <div key={index} className="flex items-center bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium px-2.5 py-1 rounded-md">
              <span>{tag.text}</span>
            </div>
          )) : <span className="text-sm text-gray-500 italic px-1">{t('noTagsAssigned')}.</span>}
        </div>
      )}
    </div>
  );
};