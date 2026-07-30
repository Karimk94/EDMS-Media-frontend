import React, { useEffect, useState } from 'react';
import { useAnalysis } from '../../hooks/useAnalysis';
import { useToast } from '../context/ToastContext';
import { LoadingButton } from './LoadingButton';
import { PersonSelector } from './PersonSelector';
import Image from 'next/image';

import { AnalysisViewProps } from '../../interfaces/PropsInterfaces';

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, docId, apiURL, onUpdateAbstractSuccess, lang, theme, t }) => {
  const [faceNames, setFaceNames] = useState<{ [key: number]: string }>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [savingFaceIndex, setSavingFaceIndex] = useState<number | null>(null);
  const { showToast } = useToast();
  const { addFace, addPerson, updateAbstract } = useAnalysis();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

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
      showToast(t('NameForFace'), 'warning');
      return;
    }
    setSavingFaceIndex(face.index);
    setSavingFaceIndex(face.index);
    try {
      await addFace({
        name: name.trim(),
        location: face.location,
        original_image_b64: result.original_image_b64,
      });
      showToast(`${t('SuccessfullySaved')} "${name.trim()}" ${t('toTheKnownFacesDatabase')}`, 'success');

      await addPerson({ name: name.trim(), lang: lang });


    } catch (error: any) {
      showToast(`${t('error')}: ${error.message}`, 'error');
    } finally {
      setSavingFaceIndex(null);
    }
  };

  const confirmedNames = Object.entries(faceNames).filter(([_, name]) => name && name.trim() !== '');

  const handleUpdateAbstractClick = () => {
    const namesToSave = confirmedNames.map(([_, name]) => name.trim());
    if (namesToSave.length === 0) {
      showToast(t('noConfirmedNames'), 'warning');
      return;
    }
    setIsConfirmOpen(true);
  };

  const confirmUpdateAbstract = async () => {
    setIsConfirmOpen(false);
    const namesToSave = confirmedNames.map(([_, name]) => name.trim());

    setIsUpdating(true);
    try {
      await updateAbstract({ doc_id: docId, names: namesToSave });

      showToast(t('titleUpdatedSuccessfully'), 'success');
      onUpdateAbstractSuccess();
    } catch (err: any) {
      showToast(`${t('error')}: ${err.message}`, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const headerColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const bgColor = theme === 'dark' ? 'bg-[#1f1f1f]' : 'bg-gray-100';
  const subTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
  const mutedTextColor = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className="space-y-6 p-4 overflow-y-auto h-full relative">
      <div className="relative w-full flex justify-center">
        <Image 
          src={`data:image/jpeg;base64,${result.processed_image}`} 
          alt="Processed" 
          width={800} 
          height={600} 
          className="rounded-lg max-w-full h-auto" 
        />
      </div>

      <div className="space-y-4">
        <h3 className={`font-bold text-lg ${headerColor}`}>Detected Faces</h3>
        {result.faces?.length > 0 ? (
          result.faces.map((face: any) => (
            <div key={face.index} className={`p-3 ${bgColor} rounded-lg`}>
              <div className="grid grid-cols-[auto,1fr,auto] gap-4 items-center">
                <div className="flex items-center gap-2">
                  {face.thumbnail_b64 && (
                    <Image
                      src={`data:image/jpeg;base64,${face.thumbnail_b64}`}
                      alt={`Face #${face.index}`}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-md object-cover"
                    />
                  )}
                  <label className={`font-semibold ${subTextColor}`}>Face #{face.index}</label>
                </div>

                <PersonSelector
                  apiURL={apiURL}
                  value={faceNames[face.index] || ''}
                  onChange={(name) => handleNameChange(face.index, name)}
                  lang={lang}
                  theme={theme}
                />

                <LoadingButton
                  onClick={() => handleSaveFace(face)}
                  isLoading={savingFaceIndex === face.index}
                  loadingText={null}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition disabled:bg-blue-800 flex items-center justify-center w-24"
                >
                  Save Face
                </LoadingButton>
              </div>
              {face.distance !== null && face.name !== 'Unknown' && (
                <div className={`mt-2 text-right text-xs ${mutedTextColor}`}>
                  Match Distance: <span className="font-mono text-green-400">{face.distance?.toFixed(4)}</span> (lower is better)
                </div>
              )}
            </div>
          ))
        ) : <p className={`${mutedTextColor}`}>No faces were detected in this image.</p>}
      </div>

      {confirmedNames.length > 0 && (
        <div className={`p-4 ${bgColor} rounded-lg`}>
          <h4 className={`font-semibold ${subTextColor} mb-2`}>Confirmed VIPs to be Saved to title:</h4>
          <div className="flex flex-wrap gap-2">
            {confirmedNames.map(([index, name]) => (
              <span key={index} className="flex items-center px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-full">
                {name}
                <button
                  onClick={() => handleRemoveName(parseInt(index, 10))}
                  className="ml-2 -mr-1 p-0.5 rounded-full hover:bg-green-700 focus:outline-none"
                  aria-label={`Remove ${name}`}
                >
                  <Image src="/icons/close.svg" alt="" width={12} height={12} className="invert" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={`pt-4 border-t ${borderColor}`}>
        <LoadingButton
          onClick={handleUpdateAbstractClick}
          isLoading={isUpdating}
          loadingText={t('processing')}
          disabled={confirmedNames.length === 0}
          className="w-full py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-600 transition disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          Save Confirmed Names to Title
        </LoadingButton>
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white dark:bg-[#333] rounded-lg p-6 max-w-sm w-full shadow-xl border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
            <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Confirm Update</h3>
            <p className={`mb-6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Update title with: <span className="font-semibold">{confirmedNames.map(([_, name]) => name.trim()).join(', ')}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className={`px-4 py-2 rounded ${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={confirmUpdateAbstract}
                className="px-4 py-2 bg-yellow-500 text-black font-semibold rounded hover:bg-yellow-600 transition-colors"
              >
                Yes, Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};