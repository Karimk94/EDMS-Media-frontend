import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../context/ToastContext';

export interface DocumentEventSectionProps {
  docId: number;
  initialEventName?: string;
  apiURL: string;
  isEditor: boolean;
  theme: 'light' | 'dark';
  t: Function;
  onEventUpdated?: (eventName: string | null) => void;
}

export const DocumentEventSection: React.FC<DocumentEventSectionProps> = ({
  docId,
  initialEventName,
  apiURL,
  isEditor,
  theme,
  t,
  onEventUpdated,
}) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();

  const isUserAdmin =
    (user?.security_level || '').trim().toLowerCase() === 'admin' ||
    Boolean(user?.is_ems_admin_group_member) ||
    isEditor;

  const [isEditing, setIsEditing] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current event linked to this document
  const { data: docEvent, isLoading: isLoadingDocEvent } = useQuery({
    queryKey: ['document-event', docId],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ event_id?: number; event_name?: string }>(
          `${apiURL}/document/${docId}/event`
        );
        return res || {};
      } catch (err) {
        return {};
      }
    },
    staleTime: 60 * 1000,
  });

  // Fetch list of all events for dropdown
  const { data: allEvents, isLoading: isLoadingAllEvents } = useQuery({
    queryKey: ['all-events-list', apiURL],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ events?: { id: number; name: string }[] }>(
          `${apiURL}/events?fetch_all=true`
        );
        return res.events || [];
      } catch (err) {
        return [];
      }
    },
    staleTime: 2 * 60 * 1000,
  });

  const activeEventName = docEvent?.event_name || initialEventName || null;
  const activeEventId = docEvent?.event_id ?? null;

  useEffect(() => {
    if (!isEditing) {
      setSelectedEventId(activeEventId);
      setIsCreatingNew(false);
      setNewEventName('');
    }
  }, [activeEventId, isEditing]);

  const handleStartEdit = () => {
    setSelectedEventId(activeEventId);
    setIsCreatingNew(false);
    setNewEventName('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setSelectedEventId(activeEventId);
    setIsCreatingNew(false);
    setNewEventName('');
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      let targetEventId: number | null = selectedEventId;
      let targetEventName: string | null = null;

      // If user chose to create a new event
      if (isCreatingNew) {
        const trimmed = newEventName.trim();
        if (!trimmed) {
          showToast(t('enterEventName') || 'Please enter an event name', 'error');
          setIsSubmitting(false);
          return;
        }

        const createRes = await apiClient.post<{ id?: number; message?: string }>(
          `${apiURL}/events`,
          { name: trimmed }
        );

        if (!createRes?.id) {
          throw new Error(createRes?.message || 'Failed to create event');
        }

        targetEventId = createRes.id;
        targetEventName = trimmed;
      } else if (targetEventId !== null) {
        const found = allEvents?.find((e) => e.id === targetEventId);
        targetEventName = found ? found.name : null;
      }

      // Link or unlink the document to the event
      await apiClient.put(`${apiURL}/document/${docId}/event`, {
        event_id: targetEventId,
      });

      // Update react-query cache immediately
      queryClient.setQueryData(['document-event', docId], {
        event_id: targetEventId,
        event_name: targetEventName,
      });

      // Invalidate relevant queries so folder & document lists refresh
      queryClient.invalidateQueries({ queryKey: ['document-event', docId] });
      queryClient.invalidateQueries({ queryKey: ['all-events-list'] });
      queryClient.invalidateQueries({ queryKey: ['events-names-filter'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-content-search'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });

      onEventUpdated?.(targetEventName);
      showToast(t('eventUpdated') || 'Event updated successfully', 'success');
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to update event link:', err);
      showToast(err.message || t('errorUpdatingEvent') || 'Error updating event', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const textSecondary = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
  const textMuted = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const inputBg = theme === 'dark' ? 'bg-[#222]' : 'bg-gray-100';
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const borderSecondary = theme === 'dark' ? 'border-gray-700' : 'border-gray-300';
  const buttonBg = theme === 'dark' ? 'bg-[#333]' : 'bg-gray-200';
  const buttonText = theme === 'dark' ? 'text-gray-200' : 'text-gray-800';
  const buttonHoverBg = theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-300';

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className={`font-semibold ${textSecondary}`}>{t('event') || 'Event'}</h3>
        {isUserAdmin && !isEditing && (
          <button
            type="button"
            onClick={handleStartEdit}
            className={`px-4 py-1 ${buttonBg} ${buttonText} text-xs rounded-md ${buttonHoverBg} flex-shrink-0 transition-colors`}
          >
            {t('edit') || 'Edit'}
          </button>
        )}
      </div>

      {!isEditing ? (
        <div className="flex items-center gap-2 py-1">
          {isLoadingDocEvent ? (
            <div className="h-6 w-32 skeleton-loader rounded-full"></div>
          ) : activeEventName ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <span className="truncate max-w-[280px]">{activeEventName}</span>
            </div>
          ) : (
            <p className={`text-sm ${textMuted} italic p-1`}>
              {t('noEventAssigned') || 'No event assigned'}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 mt-1">
          {!isCreatingNew ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {t('selectEvent') || 'Select an event'}
              </label>
              <select
                value={selectedEventId === null ? '' : String(selectedEventId)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedEventId(val === '' ? null : Number(val));
                }}
                disabled={isSubmitting || isLoadingAllEvents}
                className={`w-full px-3 py-2 ${inputBg} ${textPrimary} border ${borderSecondary} rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none`}
              >
                <option value="">{t('noEvent') || 'None (No event)'}</option>
                {allEvents?.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                disabled={isSubmitting}
                className="self-start text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium mt-1"
              >
                <span>+</span> {t('createNewEvent') || 'Create New Event'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {t('eventName') || 'Event Name'}
              </label>
              <input
                type="text"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder={t('enterEventName') || 'Enter event name'}
                disabled={isSubmitting}
                className={`w-full px-3 py-2 ${inputBg} ${textPrimary} border ${borderSecondary} rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none`}
                autoFocus
              />

              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewEventName('');
                }}
                disabled={isSubmitting}
                className="self-start text-xs text-gray-500 dark:text-gray-400 hover:underline flex items-center gap-1 mt-1"
              >
                ← {t('selectEvent') || 'Select from existing events'}
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {isSubmitting ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-gray-500 text-white text-xs font-semibold rounded-md hover:bg-gray-600 transition"
            >
              {t('cancel') || 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
