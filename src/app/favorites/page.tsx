"use client";

import React, { Suspense } from 'react';
import { MainDashboard } from '../components/MainDashboard';
import { PageSpinner } from '../components/Spinner';

export default function FavoritesPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <MainDashboard initialSection="favorites" />
    </Suspense>
  );
}
