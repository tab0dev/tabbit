import React, { useState, useEffect } from 'react';
import styles from './ListView.module.css';
import Favicon from '../../Shared/Favicon';
import { captureTab, getCachedCapture, didCaptureFail } from '../../../utils/capture';

// Thumbnail preview — same lazy-capture pattern as AutoCloseCard's GridTabPreview.
function TabThumbnail({ tab }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loadingText, setLoadingText] = useState('Capturing preview…');

  useEffect(() => {
    if (!tab) return;

    const cached = getCachedCapture(tab.id);
    if (cached) { setImageSrc(cached); setLoadingText(''); return; }

    if (didCaptureFail(tab.id)) { setImageSrc(null); setLoadingText('No preview available'); return; }

    setImageSrc(null);
    setLoadingText('Capturing preview…');

    let isCurrent = true;
    captureTab(tab, (dataUrl) => {
      if (!isCurrent) return;
      if (dataUrl) { setImageSrc(dataUrl); }
      else { setImageSrc(null); setLoadingText('No preview available'); }
    });

    return () => { isCurrent = false; };
  }, [tab]);

  return (
    <div className={styles.previewThumbnailContainer}>
      {!imageSrc && <div className={styles.previewLoading}>{loadingText}</div>}
      {imageSrc && (
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


function GridItemView({ tab, isSelected, isSoftSelected, groupColor, onClick, onHover, onHoverEnd }) {
  const hasDuplicates = tab.duplicates && tab.duplicates.length > 0;

  const cardClasses = [
    styles.previewCard,
    isSelected     ? styles.previewCardSelected     : '',
    isSoftSelected ? styles.previewCardSoftSelected : '',
    groupColor     ? styles.previewCardGrouped      : '',
  ].filter(Boolean).join(' ');

  const borderStyle = groupColor ? { borderLeftColor: groupColor } : undefined;

  return (
    <div
      data-tab-id={tab.id}
      className={cardClasses}
      style={borderStyle}
      onClick={(e) => onClick(tab.id, e)}
      onMouseEnter={() => onHover(tab.id)}
      onMouseLeave={() => onHoverEnd()}
    >
      {hasDuplicates && (
        <div className={styles.duplicateBadge}>
          {tab.duplicates.length + 1}
        </div>
      )}

      <div className={styles.previewCardTop}>
        <Favicon
          src={tab.favIconUrl}
          className={styles.previewFavicon}
          fallbackClass={styles.previewFaviconFallback}
        />
        <div className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
          {isSelected && '✓'}
        </div>
      </div>

      <div className={styles.previewInfo}>
        <div className={styles.previewTitleText}>{tab.title || '(Untitled)'}</div>
        <div className={styles.previewUrlText}>{tab.url}</div>
      </div>

      <TabThumbnail tab={tab} />
    </div>
  );
}

function ListItemView({ tab, isSelected, isSoftSelected, groupColor, onClick, onHover, onHoverEnd }) {
  const hasDuplicates = tab.duplicates && tab.duplicates.length > 0;

  const cardClasses = [
    styles.listItemCard,
    isSelected     ? styles.listItemCardSelected     : '',
    isSoftSelected ? styles.listItemCardSoftSelected : '',
    groupColor     ? styles.listItemCardGrouped      : '',
  ].filter(Boolean).join(' ');

  const borderStyle = groupColor ? { borderLeftColor: groupColor } : undefined;

  return (
    <div
      data-tab-id={tab.id}
      className={cardClasses}
      style={borderStyle}
      onClick={(e) => onClick(tab.id, e)}
      onMouseEnter={() => onHover(tab.id)}
      onMouseLeave={() => onHoverEnd()}
    >
      <div className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
        {isSelected && '✓'}
      </div>
      
      <Favicon
        src={tab.favIconUrl}
        className={styles.previewFavicon}
        fallbackClass={styles.previewFaviconFallback}
      />
      
      <div className={styles.listItemInfo}>
        <div className={styles.listItemTitle} title={tab.title}>{tab.title || '(Untitled)'}</div>
        <div className={styles.listItemUrl} title={tab.url}>{tab.url}</div>
      </div>

      {hasDuplicates && (
        <div className={styles.duplicateBadge} style={{ position: 'relative', top: 0, right: 0 }}>
          {tab.duplicates.length + 1}
        </div>
      )}
    </div>
  );
}

export default function ListViewTabCard(props) {
  if (props.viewMode === 'list') {
    return <ListItemView {...props} />;
  }
  return <GridItemView {...props} />;
}
