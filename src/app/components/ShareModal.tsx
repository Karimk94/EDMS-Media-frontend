import React, { useState } from 'react';
import Image from 'next/image';
import { useToast } from '../context/ToastContext';
import { useSecurityMutation } from '../../hooks/useSecurity';
import { LoadingButton } from './LoadingButton';

import { ShareModalProps } from '../../interfaces/PropsInterfaces';

type ShareMode = 'open' | 'restricted';
const ALLOWED_DOMAIN = '@rta.ae';

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  documentId,
  folderId,
  documentName,
  itemType = 'file',
  t
}) => {
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { showToast } = useToast();
  const { generateShareLink, isGeneratingLink } = useSecurityMutation();

  const [shareMode, setShareMode] = useState<ShareMode>('open');
  const [targetEmail, setTargetEmail] = useState('');
  const [targetEmails, setTargetEmails] = useState<string[]>([]);
  const [generatedLinks, setGeneratedLinks] = useState<Array<{ email: string, link: string }>>([]);

  const [expiryDate, setExpiryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  if (!isOpen) return null;

  const validateEmail = (email: string): boolean => {
    const trimmed = email.trim().toLowerCase();
    return trimmed.endsWith(ALLOWED_DOMAIN.toLowerCase()) && trimmed.length >= 8;
  };

  const handleAddEmail = () => {
    if (!targetEmail.trim()) return;

    if (!validateEmail(targetEmail)) {
      setError(t('invalidTargetEmail') || `Email must be from ${ALLOWED_DOMAIN} domain`);
      return;
    }

    if (targetEmails.includes(targetEmail.trim().toLowerCase())) {
      setTargetEmail('');
      return;
    }

    setTargetEmails([...targetEmails, targetEmail.trim().toLowerCase()]);
    setTargetEmail('');
    setError(null);
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setTargetEmails(targetEmails.filter(e => e !== emailToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleGenerateLink = async () => {
    let emailsToProcess = [...targetEmails];

    if (shareMode === 'restricted') {
      // If there's text in the input, try to add it
      if (targetEmail.trim()) {
        if (!validateEmail(targetEmail)) {
          setError(t('invalidTargetEmail') || `Email must be from ${ALLOWED_DOMAIN} domain`);
          return;
        }
        emailsToProcess.push(targetEmail.trim().toLowerCase());
      }

      if (emailsToProcess.length === 0) {
        setError(t('targetEmailRequired'));
        return;
      }
    }

    setError(null);
    try {
      const data = await generateShareLink({
        itemType,
        documentId,
        folderId,
        documentName,
        expiryDate,
        shareMode,
        targetEmails: emailsToProcess.length > 0 ? emailsToProcess : undefined
      });

      if (data.links && data.links.length > 0) {
        setGeneratedLinks(data.links);
        // If only one link, also set the main one for backward compat view
        if (data.links.length === 1) {
          setGeneratedLink(data.links[0].link);
        } else {
          setGeneratedLink('multiple'); // Logic flag to show multiple view
        }
      } else {
        // Fallback / Open mode
        const origin = window.location.origin;
        const fullLink = `${origin}/shared/${data.token}`;
        setGeneratedLink(fullLink);
      }

    } catch (err: any) {
      setError(err.message || 'Could not generate share link. Please try again.');
    }
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      showToast(t('LinkCopied'), 'success');
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setGeneratedLinks([]);
    setError(null);
    setShareMode('open');
    setTargetEmail('');
    setTargetEmails([]);
    onClose();
  };

  // Determine icon and colors based on item type
  const isFolder = itemType === 'folder';
  const iconBgColor = isFolder ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-blue-100 dark:bg-blue-900/20';
  const iconColor = isFolder ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" role="dialog" aria-modal="true" aria-label="Share document">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        {/* Header with Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${iconBgColor}`}>
            {isFolder ? (
              <Image src="/icons/folder-outline.svg" alt="" width={24} height={24} className={iconColor.includes('yellow') ? '' : 'dark:invert'} />
            ) : (
              <Image src="/icons/file-outline.svg" alt="" width={24} height={24} className="dark:invert" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('share') || 'Share'} {isFolder ? (t('folder') || 'Folder') : (t('file') || 'File')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[280px]" title={documentName}>
              {documentName}
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          {isFolder
            ? (t('shareFolderDescription'))
            : t('shareDescription')
          }
        </p>

        {!generatedLink ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('shareMode')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShareMode('open')}
                  className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${shareMode === 'open'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  <div className="font-medium">{t('openAccess')}</div>
                  <div className="text-xs opacity-75 mt-0.5">{t('anyRtaEmail') || `Any ${ALLOWED_DOMAIN}`}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setShareMode('restricted')}
                  className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${shareMode === 'restricted'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  <div className="font-medium">{t('restrictedAccess') || 'Specific Person'}</div>
                  <div className="text-xs opacity-75 mt-0.5">{t('oneEmailOnly') || 'One email only'}</div>
                </button>
              </div>
            </div>

            {/* Target Email Input (only for restricted mode) */}
            {shareMode === 'restricted' && (
              <div className="mb-4">
                <label htmlFor="target-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('recipientEmail')} <span className="text-red-500">*</span>
                </label>

                {/* Added Emails List */}
                {targetEmails.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {targetEmails.map((email) => (
                      <div key={email} className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs">
                        <span>{email}</span>
                        <button
                          onClick={() => handleRemoveEmail(email)}
                          className="hover:text-red-500 focus:outline-none"
                        >
                          <Image src="/icons/close.svg" alt="" width={12} height={12} className="dark:invert" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    id="target-email"
                    type="email"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`name${ALLOWED_DOMAIN}`}
                    className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm ${targetEmail && !validateEmail(targetEmail)
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    disabled={!targetEmail || !validateEmail(targetEmail)}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    <Image src="/icons/plus.svg" alt="" width={20} height={20} className="dark:invert" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('targetEmailHint') || `Only emails ending with ${ALLOWED_DOMAIN} are allowed`}
                </p>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="expiry-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('expiryDate')}
              </label>
              <input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            {/* Folder share notice */}
            {isFolder && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Image src="/icons/info.svg" alt="" width={20} height={20} className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {t('folderShareNotice')}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p className="mb-4 text-sm text-red-500">{error}</p>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="mr-3 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"
              >
                {t('cancel') || 'Cancel'}
              </button>
              <LoadingButton
                onClick={handleGenerateLink}
                isLoading={isGeneratingLink}
                loadingText={t('generating')}
                disabled={shareMode === 'restricted' && targetEmails.length === 0 && !validateEmail(targetEmail)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('generateLink')}
              </LoadingButton>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {generatedLink === 'multiple' ? (
              <div className="max-h-[300px] overflow-y-auto pr-1 space-y-3">
                <p className="text-sm text-green-600 font-medium mb-2">
                  {t('generatedLinksSuccess') || `Successfully generated ${generatedLinks.length} links:`}
                </p>
                {generatedLinks.map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{item.email}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.link);
                          showToast(t('LinkCopied'), 'success');
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs"
                      >
                        {t('copy') || 'Copy'}
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 font-mono truncate select-all">
                      {item.link}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className={`p-3 rounded-md text-sm ${shareMode === 'restricted'
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                  }`}>
                  {shareMode === 'restricted'
                    ? `${t('restrictedTo')} ${targetEmail || targetEmails.join(', ')}`
                    : (t('openAccessInfo') || `Any ${ALLOWED_DOMAIN} email can access this link`)
                  }
                </div>

                {/* Share type indicator */}
                <div className={`p-3 rounded-md text-sm flex items-center gap-2 ${isFolder
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                  }`}>
                  {isFolder ? (
                    <>
                      <Image src="/icons/folder-outline.svg" alt="" width={16} height={16} />
                      {t('folderShareCreated')}
                    </>
                  ) : (
                    <>
                      <Image src="/icons/file-outline.svg" alt="" width={16} height={16} className="dark:invert" />
                      {t('fileShareCreated')}
                    </>
                  )}
                </div>

                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 break-all text-sm text-gray-800 dark:text-gray-200">
                  {generatedLink}
                </div>
              </>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300"
              >
                {t('close')}
              </button>
              {generatedLink !== 'multiple' && (
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                >
                  {t('copyLink')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareModal;