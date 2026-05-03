import React, { useState, useEffect } from 'react';
import styles from './Card.module.css';
import { captureTab, getCachedCapture, didCaptureFail } from '../../utils/capture';
import CRTOverlay from './CRTOverlay';

export default function PreviewPanel({ tab }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loadingText, setLoadingText] = useState('Capturing preview…');
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (!tab) return;

    // 1. check if already cached
    const cached = getCachedCapture(tab.id);
    if (cached) {
      setImageSrc(cached);
      setLoadingText('');
      setIsHidden(false);
      return;
    }

    // 2. Check if it previously failed
    if (didCaptureFail(tab.id)) {
      setImageSrc(null);
      setLoadingText(
        tab.url?.includes('chrome-extension://')
          ? 'Extensions cannot be previewed'
          : 'No preview available'
      );
      setIsHidden(false);
      return;
    }

    // 3. Initiate capture otherwise
    setImageSrc(null);
    setLoadingText('Capturing preview…');
    setIsHidden(false);

    let isCurrent = true;

    captureTab(tab, (dataUrl) => {
      // ignore if navigated away before it finished capturing
      if (!isCurrent) return;

      if (dataUrl) {
        setImageSrc(dataUrl);
      } else {
        setImageSrc(null);
        setLoadingText(
          tab.url?.includes('chrome-extension://')
            ? 'Extensions cannot be previewed'
            : 'No preview available'
        );
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [tab]);

  if (!tab) return (
    <div className={styles.preview}>
      <CRTOverlay />
    </div>
  );

  return (
    <div className={styles.preview}>
      {!imageSrc && !isHidden && (
        <div className={styles.previewLoading}>{loadingText}</div>
      )}
      {imageSrc && !isHidden && (
        <img
          src={imageSrc}
          className={styles.previewImg}
          alt="Preview"
          draggable="false"
        />
      )}
      {/* CRT overlays: scanlines via .preview::before, flicker + sweep here */}
      <CRTOverlay />
    </div>
  );
}
