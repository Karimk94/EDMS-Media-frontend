import React from 'react';
import { AsyncPaginate } from 'react-select-async-paginate';
import { GroupBase, OptionsOrGroups } from 'react-select';
import { Document } from './DocumentItem'; // Import Document type if needed for context

interface EventOption {
  value: number; // Event ID
  label: string; // Event Name
}

interface EventEditorProps {
  docId?: number; // Optional: For associating event with a specific doc in modals
  apiURL: string;
  selectedEvent: EventOption | null;
  setSelectedEvent: (event: EventOption | null) => void;
  // Optional: For handling event changes specifically in modals
  onEventChange?: (docId: number, eventId: number | null) => Promise<boolean>;
}

export const EventEditor: React.FC<EventEditorProps> = ({
  docId,
  apiURL,
  selectedEvent,
  setSelectedEvent,
  onEventChange
}) => {
  const loadEventOptions = async (
    search: string,
    loadedOptions: OptionsOrGroups<EventOption, GroupBase<EventOption>>,
    additional: { page: number } | undefined
  ): Promise<{ options: EventOption[]; hasMore: boolean; additional?: { page: number } }> => {
    const page = additional?.page || 1;
    try {
      const response = await fetch(`${apiURL}/events?page=${page}&search=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();

      return {
        options: data.events.map((event: any) => ({
          value: event.id,
          label: event.name,
        })),
        hasMore: data.hasMore,
        additional: data.hasMore ? { page: page + 1 } : undefined,
      };
    } catch (error) {
      console.error("Error loading event options:", error);
      return { options: [], hasMore: false };
    }
  };

  // Function to create a new event
  const createEvent = async (inputValue: string): Promise<EventOption | null> => {
    if (!inputValue || inputValue.trim().length < 3) {
        alert("Event name must be at least 3 characters long.");
        return null;
    }
    try {
      const response = await fetch(`${apiURL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inputValue.trim() }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create event');
      }
      const newEvent = await response.json();
      const newOption = { value: newEvent.id, label: inputValue.trim() };
      // No need to call setSelectedEvent here, Creatable handles it
      alert(newEvent.message || 'Event created successfully');
      return newOption; // Return the new option for Creatable
    } catch (error: any) {
      console.error("Error creating event:", error);
      alert(`Error: ${error.message}`);
      return null;
    }
  };

  const handleChange = async (newValue: EventOption | null) => {
     // If used within a document modal context, update the association
    if (docId && onEventChange) {
        const success = await onEventChange(docId, newValue ? newValue.value : null);
        if (success) {
            setSelectedEvent(newValue); // Update local state only if backend update is successful
        } else {
             // Optionally revert UI or show error, here we just log it
             console.error("Failed to update event association in backend for docId:", docId);
        }
    } else {
         // If used outside a modal (like upload), just update the state directly
         setSelectedEvent(newValue);
    }
  };

  // --- react-select styles ---
  const selectStyles = {
    control: (base: any) => ({ ...base, backgroundColor: '#121212', borderColor: '#4b5563', minHeight: '38px', height: '38px' }),
    menu: (base: any) => ({ ...base, backgroundColor: '#282828', zIndex: 60 }), // Ensure menu is above modal content
    option: (base: any, { isFocused }: any) => ({ ...base, backgroundColor: isFocused ? '#4b5563' : '#282828', color: '#e2e8f0', padding: '8px 12px' }),
    singleValue: (base: any) => ({ ...base, color: '#e2e8f0' }),
    input: (base: any) => ({ ...base, color: '#e2e8f0', margin: '0px' }), // Adjust input margin
    valueContainer: (base: any) => ({...base, padding: '0 6px'}), // Adjust padding inside control
    indicatorSeparator: () => ({ display: 'none'}), // Hide separator
    dropdownIndicator: (base: any) => ({...base, padding: '4px'}), // Adjust dropdown arrow padding
    clearIndicator: (base: any) => ({...base, padding: '4px'}), // Adjust clear button padding
    placeholder: (base: any) => ({...base, color: '#9ca3af'}), // Style placeholder
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-1">Event</label>
      <AsyncPaginate
        isClearable
        value={selectedEvent}
        loadOptions={loadEventOptions}
        onChange={handleChange}
        {...({ onCreateOption: createEvent } as any)} // Cast to any because AsyncPaginate's typings don't include onCreateOption
        getNewOptionData={(inputValue: any, optionLabel: any) => ({ value: -1, label: `Create "${optionLabel}"` })} // Customize create label
        formatCreateLabel={(inputValue: any) => `Create new event: "${inputValue}"`}
        placeholder="Select or create an event..."
        debounceTimeout={300} // Add debounce for searching
        additional={{
          page: 1,
        }}
        styles={selectStyles} // Apply custom styles
        // Ensure menuPortalTarget is set if used inside elements with overflow:hidden or specific z-index
        // menuPortalTarget={document.body}
      />
    </div>
  );
};
