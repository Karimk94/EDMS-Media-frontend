import { useMemo, useCallback } from 'react';
import { Document } from '../models/Document';

export interface DocumentGroup {
  groupName: string;
  documents: Document[];
}

export interface UseDocumentGroupsReturn {
  groups: Map<string, Document[]>; // Map of docname to documents
  getGroupIndex: (docname: string) => number; // Which group is this
  getDocumentIndexInGroup: (docname: string, docId: number) => number; // Position in group
  getNextDocumentInGroup: (docname: string, currentDocId: number) => Document | null;
  getPreviousDocumentInGroup: (docname: string, currentDocId: number) => Document | null;
  getGroupDocuments: (docname: string) => Document[];
  isGrouped: (docname: string) => boolean; // True if docname has multiple documents
}

/**
 * Hook to manage document grouping and navigation for the collage feature.
 * Groups documents by their docname (filename) to support stacked collage display.
 */
export function useDocumentGroups(documents: Document[]): UseDocumentGroupsReturn {
  const groups = useMemo(() => {
    const groupMap = new Map<string, Document[]>();
    
    documents.forEach((doc) => {
      const key = doc.docname;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(doc);
    });

    return groupMap;
  }, [documents]);

  const getGroupIndex = useCallback((docname: string): number => {
    let index = 0;
    for (const [name] of groups) {
      if (name === docname) return index;
      index++;
    }
    return -1;
  }, [groups]);

  const getDocumentIndexInGroup = useCallback((docname: string, docId: number): number => {
    const groupDocs = groups.get(docname);
    if (!groupDocs) return -1;
    return groupDocs.findIndex((doc) => doc.doc_id === docId);
  }, [groups]);

  const getNextDocumentInGroup = useCallback((docname: string, currentDocId: number): Document | null => {
    const groupDocs = groups.get(docname);
    if (!groupDocs || groupDocs.length <= 1) return null;

    const currentIndex = groupDocs.findIndex((doc) => doc.doc_id === currentDocId);
    if (currentIndex === -1 || currentIndex >= groupDocs.length - 1) return null;

    return groupDocs[currentIndex + 1];
  }, [groups]);

  const getPreviousDocumentInGroup = useCallback((docname: string, currentDocId: number): Document | null => {
    const groupDocs = groups.get(docname);
    if (!groupDocs || groupDocs.length <= 1) return null;

    const currentIndex = groupDocs.findIndex((doc) => doc.doc_id === currentDocId);
    if (currentIndex <= 0) return null;

    return groupDocs[currentIndex - 1];
  }, [groups]);

  const getGroupDocuments = useCallback((docname: string): Document[] => {
    return groups.get(docname) || [];
  }, [groups]);

  const isGrouped = useCallback((docname: string): boolean => {
    const groupDocs = groups.get(docname);
    return !!groupDocs && groupDocs.length > 1;
  }, [groups]);

  return {
    groups,
    getGroupIndex,
    getDocumentIndexInGroup,
    getNextDocumentInGroup,
    getPreviousDocumentInGroup,
    getGroupDocuments,
    isGrouped,
  };
}
