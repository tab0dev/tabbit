import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BombIcon } from '@phosphor-icons/react';
import styles from './AutoCloseCard.module.css';
import Select from '../../Shared/Select';
import Tooltip from '../../Shared/Tooltip';
import InfoIconWithTooltip from '../../Shared/InfoIconWithTooltip';
import Favicon from '../../Shared/Favicon';
import { useTriage } from '../../../store/TriageProvider';
import { useTriageActions } from '../../../hooks/useTriageActions';
import { captureTab, getCachedCapture, didCaptureFail } from '../../../utils/capture';
import { THRESHOLDS } from '../../../utils/autoCloseThresholds';

function DuplicateBadge({ count }) {
  const [hovered, setHovered] = useState(false);
  const badgeRef = useRef(null);

  return (
    <>
      <div
        ref={badgeRef}
        className={styles.duplicateBadge}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {count}
      </div>
      <Tooltip anchorRef={badgeRef} visible={hovered} placement="top">
        Selecting this tab will also select all {count} duplicate copies
      </Tooltip>
    </>
  );
}



function GridTabPreview({ tab }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loadingText, setLoadingText] = useState('Capturing preview…');
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (!tab) return;

    const cached = getCachedCapture(tab.id);
    if (cached) {
      setImageSrc(cached);
      setLoadingText('');
      setIsHidden(false);
      return;
    }

    if (didCaptureFail(tab.id)) {
      setImageSrc(null);
      setLoadingText('No preview available');
      setIsHidden(false);
      return;
    }

    setImageSrc(null);
    setLoadingText('Capturing preview…');
    setIsHidden(false);

    let isCurrent = true;

    captureTab(tab, (dataUrl) => {
      if (!isCurrent) return;
      if (dataUrl) {
        setImageSrc(dataUrl);
      } else {
        setImageSrc(null);
        setLoadingText('No preview available');
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [tab]);

  return (
    <div className={styles.previewThumbnailContainer}>
      {!imageSrc && !isHidden && (
        <div className={styles.previewLoading}>{loadingText}</div>
      )}
      {imageSrc && !isHidden && (
        <img
          src={imageSrc}
          className={styles.previewThumbnailImg}
          alt="Preview"
          draggable="false"
        />
      )}
    </div>
  );
}

// THRESHOLDS imported from ../../utils/autoCloseThresholds

export default function AutoCloseCard({ onClose }) {
  const { state } = useTriage();
  const { closeBatch } = useTriageActions();

  const [threshold, setThreshold] = useState('1_month');
  const [excludedIds, setExcludedIds] = useState(new Set());
  const [working, setWorking] = useState(false);

  const actionOptions = [
    { value: 'close', label: 'Close' },
    { value: 'bookmark', label: 'Bookmark & Close' }
  ];
  // only 'close' is supported for batch operations, but theoretically this could bookmark too.

  const eligibleTabs = useMemo(() => {
    const thresholdObj = THRESHOLDS.find(t => t.value === threshold);
    if (!thresholdObj) return [];

    const now = Date.now();
    return state.tabs.filter(t => !t.processed && !t.gone && !t.pinned && (now - (t.lastAccessed || now)) >= thresholdObj.ms);
  }, [state.tabs, threshold]);

  const includedTabs = useMemo(() => {
    return eligibleTabs.filter(t => !excludedIds.has(t.id));
  }, [eligibleTabs, excludedIds]);

  const allIncluded = includedTabs.length > 0 && includedTabs.length === eligibleTabs.length;

  const toggleAll = () => {
    if (allIncluded) {
      setExcludedIds(new Set(eligibleTabs.map(t => t.id)));
    } else {
      setExcludedIds(new Set());
    }
  };

  const toggleTab = (id) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (working || includedTabs.length === 0) return;
    setWorking(true);

    closeBatch(includedTabs);

    setExcludedIds(new Set());
    setWorking(false);

    if (onClose) onClose();
  };

  return (
    <div className={styles.autoCloseCard}>
      <div className={styles.header}>
        <span className={styles.title}>
          <BombIcon size={16} weight="duotone" />
          Close Old Tabs
          <InfoIconWithTooltip placement="right">Remove tabs that have been inactive for a given amount of time.</InfoIconWithTooltip>
        </span>
        <Select
          value={threshold}
          onChange={(e) => {
            setThreshold(e.target.value);
            setExcludedIds(new Set()); // Reset selections on threshold change
          }}
          options={THRESHOLDS}
        />
      </div>

      <div className={styles.content}>


        <div className={styles.previewContainer}>
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>Eligible Tabs ({eligibleTabs.length})</span>
            {eligibleTabs.length > 0 && (
              <button className={styles.toggleAllBtn} onClick={toggleAll}>
                {allIncluded ? 'Select None' : 'Select All'}
              </button>
            )}
          </div>

          <div className={styles.previewGridScroll}>
            {eligibleTabs.length === 0 ? (
              <div className={styles.emptyState}>
                No tabs match the selected time threshold.
              </div>
            ) : (
              <div className={styles.previewGrid}>
                {eligibleTabs.map(tab => {
                  const isExcluded = excludedIds.has(tab.id);
                  return (
                    <div
                      key={tab.id}
                      className={`${styles.previewCard} ${isExcluded ? styles.previewCardExcluded : ''}`}
                      onClick={() => toggleTab(tab.id)}
                    >
                      {tab.duplicates && tab.duplicates.length > 0 && (
                        <DuplicateBadge count={tab.duplicates.length + 1} />
                      )}
                      <div className={styles.previewCardTop}>
                        <Favicon src={tab.favIconUrl} className={styles.previewFavicon} fallbackClass={styles.previewFaviconFallback} />
                        <div className={`${styles.checkbox} ${!isExcluded ? styles.checkboxChecked : ''}`}>
                          {!isExcluded && '✓'}
                        </div>
                      </div>
                      <div className={styles.previewInfo}>
                        <div className={styles.previewTitleText}>{tab.title || '(Untitled)'}</div>
                        <div className={styles.previewUrlText}>{tab.url}</div>
                      </div>
                      <GridTabPreview tab={tab} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.footerMeta}>
            {includedTabs.length} tab{includedTabs.length !== 1 ? 's' : ''} will be closed
          </span>
        </div>
        <div className={styles.footerRight}>
          <button className={styles.btnCancel} onClick={() => {
            setExcludedIds(new Set());
            if (onClose) onClose();
          }}>Cancel</button>
          <button
            className={`${styles.btnConfirm} ${working ? styles.btnConfirmWorking : ''}`}
            onClick={handleConfirm}
            disabled={includedTabs.length === 0 || working}
          >
            {working ? 'Processing...' : 'Close Selected'}
          </button>
        </div>
      </div>
    </div>
  );
}
