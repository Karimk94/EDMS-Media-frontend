import React from 'react';
import { Document } from './DocumentItem';
import { TagEditor } from './TagEditor';
import { CollapsibleSection } from './CollapsibleSection';

interface VideoModalProps {
  doc: Document;
  onClose: () => void;
  apiURL: string;
}

export const VideoModal: React.FC<VideoModalProps> = ({ doc, onClose, apiURL }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#282828] text-gray-200 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl">&times;</button>
          <h2 className="text-xl font-bold text-white mb-4">{doc.docname}</h2>
          <video controls autoPlay className="w-full max-h-[70vh] rounded-lg bg-black">
            <source src={`${apiURL}/video/${doc.doc_id}`} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="mt-4 mb-6">
            <CollapsibleSection title="Details">
                <h3 className="font-semibold text-gray-300">Abstract</h3>
                <p className="text-sm text-gray-400 mt-1 mb-4">{doc.title || 'No abstract available.'}</p>
                <TagEditor docId={doc.doc_id} apiURL={apiURL} />
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </div>
  );
};