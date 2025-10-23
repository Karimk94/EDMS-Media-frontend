import React from 'react';

export const DocumentItemSkeleton: React.FC = () => (
  <div className="flex flex-col">
    <div className="relative aspect-w-16 aspect-h-9 mb-2">
      <div className="w-full h-full object-cover rounded-lg bg-gray-300 animate-pulse"></div>
    </div>
    <div className="flex flex-col">
      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2 animate-pulse"></div>
      <div className="h-3 bg-gray-300 rounded w-1/2 animate-pulse"></div>
    </div>
  </div>
);