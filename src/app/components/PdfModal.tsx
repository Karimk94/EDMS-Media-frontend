import React, { useState } from 'react';
import { Document } from './DocumentItem';
import { TagEditor } from './TagEditor';

interface PdfModalProps {
  doc: Document;
  onClose: () => void;
  apiURL: string;
}

export const PdfModal: React.FC<PdfModalProps> = ({ doc, onClose, apiURL }) => {
  const [isDetailsVisible, setIsDetailsVisible] = useState(true);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 md:p-8" onClick={onClose}>
      <div className="bg-[#282828] text-gray-200 rounded-xl w-full max-w-6xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 relative flex-shrink-0 flex justify-between items-center border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">{doc.docname}</h2>
          <div className="flex items-center gap-4">
             <button
                onClick={() => setIsDetailsVisible(!isDetailsVisible)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                title={isDetailsVisible ? "Hide Details" : "Show Details"}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
              </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
          </div>
        </div>
        <div className={`flex-grow p-4 grid ${isDetailsVisible ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'} gap-4 min-h-0 transition-all duration-300`}>
          <div className={`${isDetailsVisible ? 'md:col-span-2' : 'col-span-1'} h-full`}>
            <iframe
                src={`${apiURL}/pdf/${doc.doc_id}`}
                className="w-full h-full border-0 rounded-lg bg-white"
                title={doc.docname}
            />
          </div>
          <div className={`transition-all duration-300 ${isDetailsVisible ? 'md:col-span-1 opacity-100' : 'hidden opacity-0'} p-4 bg-[#1f1f1f] rounded-lg overflow-y-auto`}>
               <h3 className="font-semibold text-gray-300">Abstract</h3>
               <p className="text-sm text-gray-400 mt-1 mb-4">{doc.title || 'No abstract available.'}</p>
               <TagEditor docId={doc.doc_id} apiURL={apiURL} />
          </div>
        </div>
      </div>
    </div>
  );
};