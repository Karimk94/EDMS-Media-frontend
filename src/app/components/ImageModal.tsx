import React, { useState, useEffect, useRef } from 'react';
import { Document } from './DocumentItem';
import { Loader } from './Loader';
import { AnalysisView } from './AnalysisView';
import { TagEditor } from './TagEditor';
import { CollapsibleSection } from './CollapsibleSection';

interface ImageModalProps {
  doc: Document;
  onClose: () => void;
  apiURL: string;
  onUpdateAbstractSuccess: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ doc, onClose, apiURL, onUpdateAbstractSuccess }) => {
  const [view, setView] = useState<'image' | 'analysis'>('image');
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const originalImageBlob = useRef<Blob | null>(null);
  
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
                    <h3 className="font-semibold text-gray-300">Abstract</h3>
                    <p className="text-sm text-gray-400 mt-1 mb-4">{doc.title || 'No abstract available.'}</p>
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