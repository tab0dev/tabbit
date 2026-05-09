import React from 'react';
import styles from './Card.module.css';
import { Bomb, Browsers, Gear, ListNumbers, Lightning, MagicWandIcon, Magnet, YoutubeLogo } from '@phosphor-icons/react';
import { useAutoCloserStatus } from '../../hooks/useAutoCloser';
import { useHasYouTubeTabs } from '../../store/TriageProvider';
import { useAutoGrouperStatus } from '../../hooks/useAutoGrouper';

export default function CardActionMenu({ onNavigate, onCloseMenu }) {
  const isAutoCloseEnabled = useAutoCloserStatus();
  const hasYouTubeTabs = useHasYouTubeTabs();
  const isAutoGrouperEnabled = useAutoGrouperStatus();

  const handleItemClick = (e, view) => {
    e.stopPropagation();
    onCloseMenu();
    onNavigate(view);
  };

  return (
    <>
      {hasYouTubeTabs && (
        <button
          className={`${styles.menuItem} ${styles.menuItemYoutube}`}
          onClick={(e) => handleItemClick(e, 'watchlater')}
        >
          <YoutubeLogo size={20} weight="duotone" />
          <span>Add to Watch Later</span>
        </button>
      )}
      <button
        className={`${styles.menuItem} ${styles.menuItemWand}`}
        onClick={(e) => handleItemClick(e, 'autotabgroup')}
      >
        <MagicWandIcon size={20} weight="duotone" />
        <span>Group tabs</span>
      </button>
      <button
        className={`${styles.menuItem} ${styles.menuItemMagnet}`}
        onClick={(e) => handleItemClick(e, 'autotabgrouperworker')}
      >
        <Magnet size={20} weight="duotone" className={isAutoGrouperEnabled ? styles.menuActiveIcon : ''} />
        <span>{isAutoGrouperEnabled ? 'Auto grouper' : 'Set-up auto grouper'}</span>
      </button>
      <button
        className={`${styles.menuItem} ${styles.menuItemBomb}`}
        onClick={(e) => handleItemClick(e, 'autoclose')}
      >
        <Bomb size={20} weight="duotone" />
        <span>Close old tabs</span>
      </button>
      <button
        className={`${styles.menuItem} ${styles.menuItemLightning}`}
        onClick={(e) => handleItemClick(e, 'autocloserworker')}
      >
        <Lightning size={20} weight="duotone" className={isAutoCloseEnabled ? styles.menuActiveIcon : ''} />
        <span>{isAutoCloseEnabled ? 'Auto closer' : 'Set-up auto closer'}</span>
      </button>
      <button
        className={`${styles.menuItem} ${styles.menuItemSort}`}
        onClick={(e) => handleItemClick(e, 'tabsorter')}
      >
        <ListNumbers size={20} weight="duotone" />
        <span>Sort tabs</span>
      </button>
      {/* <button
        className={`${styles.menuItem} ${styles.menuItemSort}`}
        onClick={(e) => handleItemClick(e, 'listview')}
      >
        <Browsers size={20} weight="duotone" />
        <span>Browse all tabs</span>
      </button> */}
      <div className={styles.menuDivider} />
      <button
        className={styles.menuItem}
        onClick={(e) => handleItemClick(e, 'settings')}
      >
        <Gear size={20} weight="duotone" />
        <span>Settings</span>
      </button>
    </>
  );
}
