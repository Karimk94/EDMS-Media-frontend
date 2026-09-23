import { Suspense } from 'react';
import { MainDashboard } from '../../components/MainDashboard';
import { PageSpinner } from '../../components/Spinner';

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
    const { folderId } = await params;
    return (
        <Suspense fallback={<PageSpinner />}>
            <MainDashboard initialSection="folders" initialFolderId={folderId} />
        </Suspense>
    );
}
