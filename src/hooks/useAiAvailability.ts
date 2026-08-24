import { useState, useEffect } from 'react';
import { isAiAvailable, downloadModel } from '../services/aiGroupingService';

export interface AiAvailabilityReturn {
  aiStatus:
    | 'checking'
    | 'available'
    | 'unavailable'
    | 'generating'
    | 'error'
    | 'downloading'
    | 'downloadable';
  setAiStatus: React.Dispatch<
    React.SetStateAction<
      | 'checking'
      | 'available'
      | 'unavailable'
      | 'generating'
      | 'error'
      | 'downloading'
      | 'downloadable'
    >
  >;
  downloadProgress: number;
  showAiModal: boolean;
  setShowAiModal: React.Dispatch<React.SetStateAction<boolean>>;
  isModelPhysicallyAvailable: boolean;
  isModelDownloaded: boolean;
}

export function useAiAvailability(): AiAvailabilityReturn {
  // aiStatus: 'checking' | 'available' | 'unavailable' | 'generating' | 'error' | 'downloading' | 'downloadable'
  const [aiStatus, setAiStatus] = useState<
    | 'checking'
    | 'available'
    | 'unavailable'
    | 'generating'
    | 'error'
    | 'downloading'
    | 'downloadable'
  >('checking');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [isModelPhysicallyAvailable, setIsModelPhysicallyAvailable] = useState<boolean>(false);
  const [isModelDownloaded, setIsModelDownloaded] = useState<boolean>(false);

  // check ai availability on mount
  useEffect(() => {
    let cancelled = false;
    console.log('[useAiAvailability] Checking AI availability on mount...');
    isAiAvailable().then((result) => {
      if (cancelled) return;
      const isOptedIn = localStorage.getItem('ai_opt_in') === 'true';
      const isDownloadRequested = localStorage.getItem('ai_download_requested') === 'true';
      console.log(
        '[useAiAvailability] isAiAvailable result:',
        result,
        'isOptedIn:',
        isOptedIn,
        'isDownloadRequested:',
        isDownloadRequested,
      );

      const isHardwareSupported = result.available || result.downloading || result.downloadable;
      setIsModelPhysicallyAvailable(Boolean(isHardwareSupported));
      setIsModelDownloaded(Boolean(result.available));

      if (!isHardwareSupported) {
        console.log('[useAiAvailability] Setting status to unavailable');
        setAiStatus('unavailable');
      } else if (isOptedIn && result.available) {
        console.log('[useAiAvailability] Setting status to available');
        setAiStatus('available');
      } else if (isOptedIn && isDownloadRequested && (result.downloading || result.downloadable)) {
        // If opted in and requested download, but not available, it should be downloading
        console.log('[useAiAvailability] Setting status to downloading');
        setAiStatus('downloading');
      } else {
        // Supported, but either not opted in or download not requested. Click should show modal.
        console.log(
          '[useAiAvailability] Setting status to downloadable (requires opt in / download request)',
        );
        setAiStatus('downloadable');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // download progress tracking
  useEffect(() => {
    if (aiStatus !== 'downloading') return;
    const controller = new AbortController();

    console.log('[useAiAvailability] initiating downloadModel...');
    downloadModel(
      (progress) => {
        setDownloadProgress(progress);
      },
      { signal: controller.signal },
    )
      .then(() => {
        console.log('[useAiAvailability] downloadModel resolved. Setting available.');
        setAiStatus('available');
        setDownloadProgress(1);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.warn('[useAiAvailability] Model download failed:', err);
        setAiStatus('unavailable');
      });

    return () => controller.abort();
  }, [aiStatus]);

  return {
    aiStatus,
    setAiStatus,
    downloadProgress,
    showAiModal,
    setShowAiModal,
    isModelPhysicallyAvailable,
    isModelDownloaded,
  };
}
