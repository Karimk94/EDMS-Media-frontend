"use client";

import React, { Suspense } from 'react';
import { Document } from '../../models/Document';

// Lazy-loaded modal components for code-splitting
const ExcelModal = React.lazy(() => import('./ExcelModal').then(m => ({ default: m.ExcelModal })));
const FileModal = React.lazy(() => import('./FileModal').then(m => ({ default: m.FileModal })));
const ImageModal = React.lazy(() => import('./ImageModal').then(m => ({ default: m.ImageModal })));
const PdfModal = React.lazy(() => import('./PdfModal').then(m => ({ default: m.PdfModal })));
const PowerPointModal = React.lazy(() => import('./PowerPointModal').then(m => ({ default: m.PowerPointModal })));
const TxtModal = React.lazy(() => import('./TxtModal').then(m => ({ default: m.TxtModal })));
const VideoModal = React.lazy(() => import('./VideoModal').then(m => ({ default: m.VideoModal })));
const WordModal = React.lazy(() => import('./WordModal').then(m => ({ default: m.WordModal })));

import { Spinner } from './Spinner';

const ModalLoadingFallback = () => (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
        <Spinner size="lg" />
    </div>
);

interface DocumentModalsProps {
    selectedDoc: Document | null;
    selectedVideo: Document | null;
    selectedPdf: Document | null;
    selectedFile: Document | null;
    selectedTxt: Document | null;
    selectedExcel: Document | null;
    selectedPPT: Document | null;
    selectedWord: Document | null;
    onCloseDoc: () => void;
    onCloseVideo: () => void;
    onClosePdf: () => void;
    onCloseFile: () => void;
    onCloseTxt: () => void;
    onCloseExcel: () => void;
    onClosePPT: () => void;
    onCloseWord: () => void;
    onUpdateSuccess: () => void;
    apiURL: string;
    isEditor: boolean;
    t: Function;
    lang: 'en' | 'ar';
    theme: 'light' | 'dark';
}

/**
 * Renders all document preview modals (Image, Video, PDF, File, Txt, Excel, PPT, Word).
 * Only the active modal is rendered. Modals are lazy-loaded for performance.
 */
export function DocumentModals({
    selectedDoc, selectedVideo, selectedPdf, selectedFile,
    selectedTxt, selectedExcel, selectedPPT, selectedWord,
    onCloseDoc, onCloseVideo, onClosePdf, onCloseFile,
    onCloseTxt, onCloseExcel, onClosePPT, onCloseWord,
    onUpdateSuccess, apiURL, isEditor, t, lang, theme
}: DocumentModalsProps) {
    return (
        <Suspense fallback={<ModalLoadingFallback />}>
            {selectedDoc && <ImageModal doc={selectedDoc} onClose={onCloseDoc} apiURL={apiURL} onUpdateAbstractSuccess={onUpdateSuccess} isEditor={isEditor} t={t} lang={lang} theme={theme} />}
            {selectedVideo && <VideoModal doc={selectedVideo} onClose={onCloseVideo} apiURL={apiURL} onUpdateAbstractSuccess={onUpdateSuccess} isEditor={isEditor} t={t} lang={lang} theme={theme} />}
            {selectedPdf && <PdfModal doc={selectedPdf} onClose={onClosePdf} apiURL={apiURL} onUpdateAbstractSuccess={onUpdateSuccess} isEditor={isEditor} t={t} lang={lang} theme={theme} />}
            {selectedFile && <FileModal doc={selectedFile} onClose={onCloseFile} apiURL={apiURL} onUpdateAbstractSuccess={onUpdateSuccess} isEditor={isEditor} t={t} lang={lang} theme={theme} />}
            {selectedTxt && <TxtModal doc={selectedTxt} onClose={onCloseTxt} apiURL={apiURL} onUpdateAbstractSuccess={onUpdateSuccess} isEditor={isEditor} t={t} lang={lang} theme={theme} />}
            {selectedExcel && <ExcelModal doc={selectedExcel} onClose={onCloseExcel} apiURL={apiURL} onUpdateAbstractSuccess={onUpdateSuccess} isEditor={isEditor} t={t} lang={lang} theme={theme} />}
            {selectedPPT && <PowerPointModal doc={selectedPPT} onClose={onClosePPT} apiURL={apiURL} onUpdateAbstractSuccess={onUpdateSuccess} isEditor={isEditor} t={t} lang={lang} theme={theme} />}
            {selectedWord && <WordModal doc={selectedWord} onClose={onCloseWord} apiURL={apiURL} onUpdateAbstractSuccess={onUpdateSuccess} isEditor={isEditor} t={t} lang={lang} theme={theme} />}
        </Suspense>
    );
}

