import React from 'react';
import styles from './Card.module.css';
import { Bomb, Gear, ListNumbers, Lightning, MagicWandIcon, YoutubeLogo } from '@phosphor-icons/react';
import { useAutoCloserStatus } from '../../hooks/useAutoCloser';
import { useHasYouTubeTabs } from '../../store/TriageProvider';

export default function CardActionMenu({ onNavigate, onCloseMenu }) {
  const isAutoCloseEnabled = useAutoCloserStatus();
  const hasYouTubeTabs = useHasYouTubeTabs();

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
        <span>Make tab groups</span>
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
        <span>{isAutoCloseEnabled ? 'Auto closer' : 'Set-up auto-closer'}</span>
      </button>
      <button
        className={`${styles.menuItem} ${styles.menuItemSort}`}
        onClick={(e) => handleItemClick(e, 'tabsorter')}
      >
        <ListNumbers size={20} weight="duotone" />
        <span>Sort tabs</span>
      </button>
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
