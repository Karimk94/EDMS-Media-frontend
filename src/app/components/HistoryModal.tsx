import React from 'react';
import { useAdmin } from '../../hooks/useAdmin';
import { Spinner } from './Spinner';
import Image from 'next/image';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    docId: string;
    itemName: string;
    t: Function;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, docId, itemName, t }) => {
    const { useDocumentHistory } = useAdmin();
    const { data: history, isLoading, error } = useDocumentHistory(Number(docId), isOpen);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {t('history') || 'Activity History'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 break-all">
                            {itemName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    >
                        <Image src="/icons/close.svg" width={20} height={20} alt="Close" className="dark:invert" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6 relative min-h-[300px]">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Spinner />
                        </div>
                    ) : error ? (
                        <div className="absolute inset-0 flex items-center justify-center text-red-500">
                            {t('errorLoadingHistory') || 'Error loading history'}
                        </div>
                    ) : history && history.length > 0 ? (
                        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-400">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">{t('date') || 'Date'}</th>
                                        <th scope="col" className="px-6 py-3">{t('activity') || 'Activity'}</th>
                                        <th scope="col" className="px-6 py-3">{t('author') || 'Author'}</th>
                                        <th scope="col" className="px-6 py-3">{t('typist') || 'Typist'}</th>
                                        <th scope="col" className="px-6 py-3">{t('formName') || 'Form Name'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((entry, index) => (
                                        <tr key={index} className="bg-white border-b dark:bg-[#1e1e1e] dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {entry.start_date ? new Date(entry.start_date).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                                {entry.activity_description || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {entry.author || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {entry.typist || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {entry.form_name || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                            <Image src="/admin-icon.svg" width={48} height={48} alt="No history" className="dark:invert opacity-20 mb-4" />
                            <p>{t('noHistoryFound') || 'No activity history found for this item.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
