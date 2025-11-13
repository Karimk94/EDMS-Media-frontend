import React from 'react';

interface EventOption {
  value: number;
  label: string;
}

interface ReadOnlyEventDisplayProps {
  event: EventOption | null;
  t: Function
}

export const ReadOnlyEventDisplay: React.FC<ReadOnlyEventDisplayProps> = ({ event, t }) => {
  return (
    <div className="mb-4">
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('event')}</h4>
      <p className="text-sm text-gray-900 dark:text-gray-400 bg-white dark:bg-[#121212] p-2 rounded-md border border-gray-300 dark:border-gray-600 min-h-[38px] flex items-center">
        {event ? event.label : <span className="italic text-gray-500">{t('noEventAssigned')}</span>}
      </p>
    </div>
  );
};