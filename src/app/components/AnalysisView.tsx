import React, { useState, useEffect } from 'react';

interface AnalysisViewProps {
  result: any;
  docId: number;
  apiURL: string;
  onUpdateAbstractSuccess: () => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, docId, apiURL, onUpdateAbstractSuccess }) => {
  const [faceNames, setFaceNames] = useState<{ [key: number]: string }>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [savingFaceIndex, setSavingFaceIndex] = useState<number | null>(null);

  useEffect(() => {
    if (result?.faces) {
      const initialNames: { [key: number]: string } = {};
      result.faces.forEach((face: any) => {
        if (face.name && face.name !== 'Unknown') {
          initialNames[face.index] = face.name.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
        }
      });
      setFaceNames(initialNames);
    }
  }, [result]);

  const handleNameChange = (index: number, name: string) => {
    setFaceNames(prev => ({ ...prev, [index]: name }));
  };

  const handleRemoveName = (faceIndexToRemove: number) => {
    setFaceNames(prev => {
      const newFaceNames = { ...prev };
      delete newFaceNames[faceIndexToRemove];
      return newFaceNames;
    });
  };

  const handleSaveFace = async (face: any) => {
    const name = faceNames[face.index];
    if (!name || name.trim() === '') {
      alert('Please enter a name for this face first.');
      return;
    }
    setSavingFaceIndex(face.index);
    try {
      await fetch(`${apiURL}/add_face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          location: face.location,
          original_image_b64: result.original_image_b64,
        }),
      });
      alert(`Successfully saved "${name.trim()}" to the known faces database.`);

      await fetch(`${apiURL}/add_person`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSavingFaceIndex(null);
    }
  };
  
  const confirmedNames = Object.entries(faceNames).filter(([_, name]) => name && name.trim() !== '');

  const handleUpdateAbstract = async () => {
    const namesToSave = confirmedNames.map(([_, name]) => name.trim());
    if (namesToSave.length === 0) return alert("No confirmed names to update.");
    if (!confirm(`Update title with: ${namesToSave.join(', ')}?`)) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`${apiURL}/update_abstract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: docId, names: namesToSave }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      onUpdateAbstractSuccess();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <img src={`data:image/jpeg;base64,${result.processed_image}`} alt="Processed" className="rounded-lg mx-auto max-w-full" />
      
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-white">Detected Faces</h3>
        {result.faces?.length > 0 ? (
          result.faces.map((face: any) => (
            <div key={face.index} className="p-3 bg-[#1f1f1f] rounded-lg">
              <div className="grid grid-cols-[auto,1fr,auto] gap-4 items-center">
                <div className="flex items-center gap-2">
                  {face.thumbnail_b64 && (
                    <img
                      src={`data:image/jpeg;base64,${face.thumbnail_b64}`}
                      alt={`Face #${face.index}`}
                      className="w-16 h-16 rounded-md object-cover"
                    />
                  )}
                  <label className="font-semibold text-gray-300">Face #{face.index}</label>
                </div>
                <input 
                  type="text"
                  placeholder="Enter or correct name..."
                  value={faceNames[face.index] || ''}
                  onChange={(e) => handleNameChange(face.index, e.target.value)}
                  className="px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
                <button 
                  onClick={() => handleSaveFace(face)}
                  disabled={savingFaceIndex === face.index}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition disabled:bg-blue-800 flex items-center justify-center w-24"
                >
                  {savingFaceIndex === face.index ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    'Save Face'
                  )}
                </button>
              </div>
              {face.distance !== null && face.name !== 'Unknown' && (
                <div className="mt-2 text-right text-xs text-gray-400">
                  Match Distance: <span className="font-mono text-green-400">{face.distance?.toFixed(4)}</span> (lower is better)
                </div>
              )}
            </div>
          ))
        ) : <p className="text-gray-400">No faces were detected in this image.</p>}
      </div>

      {confirmedNames.length > 0 && (
        <div className="p-4 bg-[#1f1f1f] rounded-lg">
          <h4 className="font-semibold text-gray-300 mb-2">Confirmed VIPs to be Saved to title:</h4>
          <div className="flex flex-wrap gap-2">
            {confirmedNames.map(([index, name]) => (
              <span key={index} className="flex items-center px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-full">
                {name}
                <button 
                  onClick={() => handleRemoveName(parseInt(index, 10))}
                  className="ml-2 -mr-1 p-0.5 rounded-full hover:bg-green-700 focus:outline-none"
                  aria-label={`Remove ${name}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-gray-700">
        <button 
          onClick={handleUpdateAbstract}
          disabled={confirmedNames.length === 0 || isUpdating}
          className="w-full py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-600 transition disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isUpdating ? (
             <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
          ) : (
            'Save Confirmed Names to Title'
          )}
        </button>
      </div>
    </div>
  );
};