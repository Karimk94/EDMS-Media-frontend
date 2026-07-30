import React, { useMemo } from 'react';
import { DocumentItem } from './DocumentItem';
import { DocumentItemSkeleton } from './DocumentItemSkeleton';
import { DocumentCollage } from './DocumentCollage';
import { useDocumentTagsBatch } from '../../hooks/useDocumentTagsBatch';
import { useDocumentGroups } from '../../hooks/useDocumentGroups';

import { DocumentListProps } from '../../interfaces/PropsInterfaces';

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onDocumentClick,
  apiURL,
  onTagSelect,
  isLoading,
  processingDocs,
  enableCollage = false,
  showFavoriteButton = true,

  lang,
  t
}) => {
  const docIds = documents.map((doc) => doc.doc_id);
  const { data: tagsMap = {}, isLoading: isTagsBatchLoading } = useDocumentTagsBatch({
    docIds,
    lang,
    enabled: !isLoading,
  });

  // Group documents by name to detect collages
  const { groups, isGrouped } = useDocumentGroups(documents);

  // Get unique groups to render (each group rendered once as either collage or item)
  const uniqueGroups = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ docname: string; docs: typeof documents }> = [];
    
    for (const [docname, docs] of groups) {
      if (!seen.has(docname)) {
        seen.add(docname);
        result.push({ docname, docs });
      }
    }
    
    return result;
  }, [groups]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
      {isLoading
        ? Array.from({ length: 10 }).map((_, index) => <DocumentItemSkeleton key={index} />)
        : enableCollage ? uniqueGroups.map((group) => {
            // If multiple documents with same name, render collage where enabled.
            if (isGrouped(group.docname)) {
              return (
                <DocumentCollage
                  key={`collage-${group.docname}`}
                  documents={group.docs}
                  onCollageClick={onDocumentClick}
                  apiURL={apiURL}
                  lang={lang}
                />
              );
            }

            // Otherwise render single document normally
            const doc = group.docs[0];
            return (
              <DocumentItem
                key={doc.doc_id}
                doc={doc}
                onDocumentClick={onDocumentClick}
                apiURL={apiURL}
                onTagSelect={onTagSelect}
                isProcessing={processingDocs.includes(doc.doc_id)}
                itemTags={tagsMap[String(doc.doc_id)] || []}
                isTagsLoading={isTagsBatchLoading}
                showFavoriteButton={showFavoriteButton}
                lang={lang}
                t={t}
              />
            );
          }) : documents.map((doc) => (
            <DocumentItem
              key={doc.doc_id}
              doc={doc}
              onDocumentClick={onDocumentClick}
              apiURL={apiURL}
              onTagSelect={onTagSelect}
              isProcessing={processingDocs.includes(doc.doc_id)}
              itemTags={tagsMap[String(doc.doc_id)] || []}
              isTagsLoading={isTagsBatchLoading}
              showFavoriteButton={showFavoriteButton}
              lang={lang}
              t={t}
            />
          ))}
    </div>
  );
};
