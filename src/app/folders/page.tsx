"use client";

import React, { Suspense } from 'react';
import { MainDashboard } from '../components/MainDashboard';
import { PageSpinner } from '../components/Spinner';

export default function FoldersPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <MainDashboard initialSection="folders" />
    </Suspense>
  );
}
