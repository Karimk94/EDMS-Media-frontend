import React, { useState, useEffect, useRef } from 'react';
import { Document } from './DocumentItem';
import { Loader } from './Loader';
import { AnalysisView } from './AnalysisView';
import { TagEditor } from './TagEditor';
import { CollapsibleSection } from './CollapsibleSection';
import DatePicker from 'react-datepicker';

interface ImageModalProps {
  doc: Document;
  onClose: () => void;
  apiURL: string;
  onUpdateAbstractSuccess: () => void;
}

const safeParseDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

const formatToApiDate = (date: Date | null): string | null => {
    if (!date) return null;
    const pad = (num: number) => num.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const ImageModal: React.FC<ImageModalProps> = ({ doc, onClose, apiURL, onUpdateAbstractSuccess }) => {
  const [view, setView] = useState<'image' | 'analysis'>('image');
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const originalImageBlob = useRef<Blob | null>(null);

  const [isEditingDate, setIsEditingDate] = useState(false);
  const [documentDate, setDocumentDate] = useState<Date | null>(safeParseDate(doc.date));
  const [initialDate, setInitialDate] = useState<Date | null>(safeParseDate(doc.date));

  const [isEditingAbstract, setIsEditingAbstract] = useState(false);
  const [abstract, setAbstract] = useState(doc.title || '');
  const [initialAbstract, setInitialAbstract] = useState(doc.title || '');

  useEffect(() => {
    const fetchImage = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiURL}/image/${doc.doc_id}`);
        if (!response.ok) throw new Error('Image not found in EDMS.');
        const blob = await response.blob();
        originalImageBlob.current = blob;
        setImageSrc(URL.createObjectURL(blob));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchImage();
    return () => { if (imageSrc) URL.revokeObjectURL(imageSrc); };
  }, [doc.doc_id, apiURL]);

  const handleAnalyze = async () => {
    if (!originalImageBlob.current) return;
    setIsAnalyzing(true);
    setError(null);
    const formData = new FormData();
    formData.append('image_file', originalImageBlob.current, `${doc.doc_id}.jpg`);

    try {
      const response = await fetch(`${apiURL}/analyze_image`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error((await response.json()).error || 'Analysis failed.');
      setAnalysisResult(await response.json());
      setView('analysis');
    } catch (err: any) {
      setError(`Face Service Error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleDateChange = (date: Date | null) => {
    setDocumentDate(date);
  };

  const handleEditDate = () => {
    setInitialDate(documentDate);
    setIsEditingDate(true);
  };

  const handleCancelEditDate = () => {
    setDocumentDate(initialDate);
    setIsEditingDate(false);
  };
  
  const handleEditAbstract = () => {
    setInitialAbstract(abstract);
    setIsEditingAbstract(true);
  };

  const handleCancelEditAbstract = () => {
    setAbstract(initialAbstract);
    setIsEditingAbstract(false);
  };
  
  const handleUpdateMetadata = async () => {
    try {
      const response = await fetch(`${apiURL}/update_metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            doc_id: doc.doc_id, 
            abstract: abstract,
            date_taken: formatToApiDate(documentDate) 
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update metadata');
      alert('Metadata updated successfully');
      setIsEditingDate(false);
      setIsEditingAbstract(false);
      onUpdateAbstractSuccess();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#282828] text-gray-200 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl">&times;</button>
          <h2 className="text-xl font-bold text-white mb-4">{doc.docname}</h2>
          
          {isLoading && <Loader />}
          {error && <p className="text-center p-10 text-red-400">{error}</p>}
          
          {view === 'image' && imageSrc && !error && (
            <div>
              <div className="text-center">
                <img src={imageSrc} alt={doc.docname} className="max-w-full max-h-[60vh] mx-auto rounded-lg" />
              </div>
              <div className="mt-4">
                 <CollapsibleSection title="Details">
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-300 mb-1">Abstract</h3>
                      {isEditingAbstract ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={abstract}
                            onChange={(e) => setAbstract(e.target.value)}
                            className="w-full h-24 px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={handleUpdateMetadata} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save</button>
                            <button onClick={handleCancelEditAbstract} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <p className="text-sm text-gray-400 mt-1 pr-4">{abstract || 'No abstract available.'}</p>
                          <button onClick={handleEditAbstract} className="px-4 py-1 bg-gray-700 text-white text-xs rounded-md hover:bg-gray-600 flex-shrink-0">Edit</button>
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-300 mb-1">Date Taken</h3>
                      {isEditingDate ? (
                        <div className="flex items-center gap-2">
                          <DatePicker
                            selected={documentDate}
                            onChange={handleDateChange}
                            dateFormat="MMMM d, yyyy"
                            className="w-full px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                            isClearable
                          />
                          <button onClick={handleUpdateMetadata} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save</button>
                          <button onClick={handleCancelEditDate} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                           <p className="text-sm text-gray-400 p-2">
                            {documentDate ? documentDate.toLocaleDateString() : 'No date set'}
                          </p>
                          <button onClick={handleEditDate} className="px-4 py-1 bg-gray-700 text-white text-xs rounded-md hover:bg-gray-600">Edit</button>
                        </div>
                      )}
                    </div>

                    <TagEditor docId={doc.doc_id} apiURL={apiURL} />
                </CollapsibleSection>
              </div>
              {doc.media_type === 'image' && (
                <div className="text-center">
                  <button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing}
                    className="mt-6 px-8 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition w-64 h-14 flex items-center justify-center mx-auto disabled:bg-red-800 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing ? (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      'Analyze for Faces'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {view === 'analysis' && analysisResult && !error && (
            <AnalysisView 
              result={analysisResult} 
              docId={doc.doc_id} 
              apiURL={apiURL}
              onUpdateAbstractSuccess={onUpdateAbstractSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
};