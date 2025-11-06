import React from 'react';
import { AsyncPaginate } from 'react-select-async-paginate';
import Creatable from 'react-select/creatable';
import { GroupBase, OptionsOrGroups } from 'react-select';

const AnyAsyncPaginate: any = AsyncPaginate;

interface PersonOption {
  value: string;
  label: string;
}

interface PersonSelectorProps {
  apiURL: string;
  value: string;
  onChange: (name: string) => void;
  lang: 'en' | 'ar';
}

const selectStyles = {
  control: (base: any) => ({ ...base, backgroundColor: '#121212', borderColor: '#4b5563', minHeight: '38px', height: '38px' }),
  menuPortal: (base: any) => ({ ...base, zIndex: 99999 }),
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

export const PersonSelector: React.FC<PersonSelectorProps> = ({ apiURL, value, onChange, lang }) => {

  const loadPersonOptions = async (
    search: string,
    loadedOptions: OptionsOrGroups<PersonOption, GroupBase<PersonOption>>,
    additional: { page: number } | undefined
  ): Promise<{ options: PersonOption[]; hasMore: boolean; additional?: { page: number } }> => {
    const page = additional?.page || 1;
    try {
      const response = await fetch(`${apiURL}/persons?page=${page}&search=${encodeURIComponent(search)}&lang=${lang}`);
      if (!response.ok) throw new Error('Failed to fetch persons');
      const data = await response.json();

      const options = data.options.map((person: any) => {
        const label = (lang === 'ar' && person.name_arabic)
          ? `${person.name_arabic} - ${person.name_english}`
          : `${person.name_english}${person.name_arabic ? ` - ${person.name_arabic}` : ''}`;
        
        const value = (lang === 'ar' && person.name_arabic) ? person.name_arabic : person.name_english;

        return { value: value, label };
      });

      return {
        options: options,
        hasMore: data.hasMore,
        additional: data.hasMore ? { page: page + 1 } : undefined,
      };
    } catch (error) {
      console.error("Error loading person options:", error);
      return { options: [], hasMore: false };
    }
  };

  const handleChange = (newValue: PersonOption | null) => {
    onChange(newValue ? newValue.value : '');
  };

  const handleCreate = (inputValue: string) => {
    const trimmedName = inputValue.trim();
    if (trimmedName) {
      onChange(trimmedName);
    }
  };
  
  const currentOption: PersonOption | null = value ? { value: value, label: value } : null;

  return (
    <AnyAsyncPaginate
      SelectComponent={Creatable}
      isClearable
      key={lang}
      value={currentOption}
      loadOptions={loadPersonOptions}
      onChange={handleChange}
      onCreateOption={handleCreate}
      getNewOptionData={(inputValue: string) => ({ value: inputValue, label: inputValue })}
      formatCreateLabel={(inputValue: string) => `Create "${inputValue}"`}
      placeholder="Search or create person..."
      debounceTimeout={300}
      additional={{
        page: 1,
      }}
      styles={selectStyles}
      menuPlacement="auto"
      menuPortalTarget={document.body}
    />
  );
};