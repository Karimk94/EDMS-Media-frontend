import React from 'react';
import { AsyncPaginate } from 'react-select-async-paginate';
import Creatable from 'react-select/creatable';
import { GroupBase, OptionsOrGroups } from 'react-select';

const AnyAsyncPaginate: any = AsyncPaginate;

interface EventOption {
  value: number;
  label: string;
}

interface EventEditorProps {
  docId?: number;
  apiURL: string;
  selectedEvent: EventOption | null;
  setSelectedEvent: (event: EventOption | null) => void;
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
      const response = await fetch(`${apiURL}/events?page=${page}&search=${encodeURIComponent(search)}&fetch_all=true`);
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
      alert(newEvent.message || 'Event created successfully');
      return newOption;
    } catch (error: any) {
      console.error("Error creating event:", error);
      alert(`Error: ${error.message}`);
      return null;
    }
  };

  const handleChange = async (newValue: EventOption | null) => {
    if (docId && onEventChange) {
      const success = await onEventChange(docId, newValue ? newValue.value : null);
      if (success) {
        setSelectedEvent(newValue);
      } else {
        console.error("Failed to update event association in backend for docId:", docId);
      }
    } else {
      setSelectedEvent(newValue);
    }
  };

  const isValidNewOption = (inputValue: string, selectValue: any, selectOptions: any) => {
    if (inputValue.trim().length < 3) {
      return false;
    }
    const isOptionAlreadyPresent = selectOptions.some(
      (option: EventOption) => option.label.toLowerCase() === inputValue.toLowerCase()
    );
    return !isOptionAlreadyPresent;
  };

  const selectStyles = {
    control: (base: any) => ({ ...base, backgroundColor: '#121212', borderColor: '#4b5563', minHeight: '38px', height: '38px' }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    menu: (base: any) => ({ ...base, backgroundColor: '#282828' }),
    option: (base: any, { isFocused }: any) => ({ ...base, backgroundColor: isFocused ? '#4b5563' : '#282828', color: '#e2e8f0', padding: '8px 12px' }),
    singleValue: (base: any) => ({ ...base, color: '#e2e8f0' }),
    input: (base: any) => ({ ...base, color: '#e2e8f0', margin: '0px' }),
    valueContainer: (base: any) => ({...base, padding: '0 6px'}),
    indicatorSeparator: () => ({ display: 'none'}),
    dropdownIndicator: (base: any) => ({...base, padding: '4px'}),
    clearIndicator: (base: any) => ({...base, padding: '4px'}),
    placeholder: (base: any) => ({...base, color: '#9ca3af'}),
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-1">Event</label>
      <AnyAsyncPaginate
        SelectComponent={Creatable}
        isClearable
        value={selectedEvent}
        loadOptions={loadEventOptions}
        onChange={handleChange}
        onCreateOption={async (inputValue: string) => {
          const newOption = await createEvent(inputValue);
          if (newOption) {
            handleChange(newOption);
          }
        }}
        isValidNewOption={isValidNewOption}
        allowCreateWhileLoading={true}
        createOptionPosition="first"
        getNewOptionData={(inputValue: string) => ({ value: -1, label: inputValue })}
        formatCreateLabel={(inputValue: string) => `Create "${inputValue}"`}
        noOptionsMessage={(obj: any) => {
          const input = typeof obj === 'string' ? obj : obj?.inputValue ?? '';
          const trimmed = input.trim();
          if (trimmed.length >= 3) {
            return (
              <div
                style={{ padding: '8px 12px', cursor: 'pointer', color: '#9ca3af' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  (async () => {
                    const newOption = await createEvent(trimmed);
                    if (newOption) handleChange(newOption);
                  })();
                }}
              >
                Create "{trimmed}"
              </div>
            );
          }
          return input ? "No events found" : "Type to search events...";
        }}
        placeholder="Select or create an event..."
        debounceTimeout={300}
        additional={{
          page: 1,
        }}
        styles={selectStyles}
        // Add these two props to make the menu open upwards and avoid clipping
        menuPlacement="top"
        menuPortalTarget={document.body}
      />
    </div>
  );
};