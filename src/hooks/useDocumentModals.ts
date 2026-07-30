"use client";

import { useState, useCallback } from 'react';
import { Document } from '../models/Document';

/**
 * Manages all document modal state and the logic for opening the correct modal
 * based on the document's media type.
 */
export function useDocumentModals() {
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [selectedVideo, setSelectedVideo] = useState<Document | null>(null);
    const [selectedPdf, setSelectedPdf] = useState<Document | null>(null);
    const [selectedFile, setSelectedFile] = useState<Document | null>(null);
    const [selectedTxt, setSelectedTxt] = useState<Document | null>(null);
    const [selectedExcel, setSelectedExcel] = useState<Document | null>(null);
    const [selectedPPT, setSelectedPPT] = useState<Document | null>(null);
    const [selectedWord, setSelectedWord] = useState<Document | null>(null);

    const handleDocumentClick = useCallback((doc: Document) => {
        if (doc.media_type === 'zip') return;

        if (doc.media_type === 'video') {
            setSelectedVideo(doc);
        } else if (doc.media_type === 'image') {
            setSelectedDoc(doc);
        } else if (doc.media_type === 'pdf') {
            setSelectedPdf(doc);
        } else if (doc.media_type === 'text') {
            setSelectedTxt(doc);
        } else if (doc.media_type === 'excel') {
            setSelectedExcel(doc);
        } else if (doc.media_type === 'powerpoint') {
            setSelectedPPT(doc);
        } else if (doc.media_type === 'word') {
            setSelectedWord(doc);
        } else {
            const ext = doc.docname.split('.').pop()?.toLowerCase();
            const textExtensions = ['txt', 'csv', 'json', 'xml', 'log', 'md', 'yml', 'yaml', 'ini', 'conf'];

            if ((ext && textExtensions.includes(ext)) || !ext) {
                setSelectedTxt(doc);
            } else {
                setSelectedFile(doc);
            }
        }
    }, []);

    const closeAll = useCallback(() => {
        setSelectedDoc(null);
        setSelectedVideo(null);
        setSelectedPdf(null);
        setSelectedFile(null);
        setSelectedTxt(null);
        setSelectedExcel(null);
        setSelectedPPT(null);
        setSelectedWord(null);
    }, []);

    return {
        selectedDoc, setSelectedDoc,
        selectedVideo, setSelectedVideo,
        selectedPdf, setSelectedPdf,
        selectedFile, setSelectedFile,
        selectedTxt, setSelectedTxt,
        selectedExcel, setSelectedExcel,
        selectedPPT, setSelectedPPT,
        selectedWord, setSelectedWord,
        handleDocumentClick,
        closeAll,
    };
}
