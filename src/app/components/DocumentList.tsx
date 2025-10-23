import React from 'react';
import { DocumentItem, Document } from './DocumentItem';
import { DocumentItemSkeleton } from './DocumentItemSkeleton';

interface DocumentListProps {
  documents: Document[];
  onDocumentClick: (doc: Document) => void;
  apiURL: string;
  onTagSelect: (tag: string) => void;
  isLoading: boolean;
  processingDocs: number[];
}

export const DocumentList: React.FC<DocumentListProps> = ({ documents, onDocumentClick, apiURL, onTagSelect, isLoading, processingDocs }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
    {isLoading
      ? Array.from({ length: 10 }).map((_, index) => <DocumentItemSkeleton key={index} />)
      : documents.map(doc => (
          <DocumentItem 
            key={doc.doc_id} 
            doc={doc} 
            onDocumentClick={onDocumentClick}
            apiURL={apiURL}
            onTagSelect={onTagSelect}
            isProcessing={processingDocs.includes(doc.doc_id)}
          />
        ))}
  </div>
);