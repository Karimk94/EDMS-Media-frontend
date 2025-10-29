import React from 'react';

interface EventOption {
  value: number; // Event ID
  label: string; // Event Name
}

interface ReadOnlyEventDisplayProps {
  event: EventOption | null;
}

export const ReadOnlyEventDisplay: React.FC<ReadOnlyEventDisplayProps> = ({ event }) => {
  return (
    <div className="mb-4">
      <h4 className="font-semibold text-gray-300 mb-1">Event</h4>
      <p className="text-sm text-gray-400 bg-[#121212] p-2 rounded-md border border-gray-600 min-h-[38px] flex items-center">
        {event ? event.label : <span className="italic text-gray-500">No event assigned</span>}
      </p>
    </div>
  );
};
