import React from 'react';
import styles from './Card.module.css';
import ActionMenu from '../Shared/ActionMenu';
import {
  Bomb,
  Gear,
  ListNumbers,
  Lightning,
  MagicWandIcon,
  Magnet,
  YoutubeLogo,
  NetworkSlash,
  Broom,
} from '@phosphor-icons/react';

import { useAutoCloserStatus } from '../../hooks/useAutoCloser';
import { useHasYouTubeTabs } from '../../store/TriageProvider';
import { useAutoGrouperStatus } from '../../hooks/useAutoGrouper';
import { useAutoSmusherStatus } from '../../hooks/useAutoSmusher';
import { useAutoSorterStatus } from '../../hooks/useAutoSorter';

export interface CardActionMenuProps {
  onNavigate: (view: string) => void;
  onCloseMenu: () => void;
}

export default function CardActionMenu({ onNavigate, onCloseMenu }: CardActionMenuProps) {
  const isAutoCloseEnabled = useAutoCloserStatus();
  const hasYouTubeTabs = useHasYouTubeTabs();
  const isAutoGrouperEnabled = useAutoGrouperStatus();
  const isAutoSmusherEnabled = useAutoSmusherStatus();
  const isAutoSorterEnabled = useAutoSorterStatus();

  const handleItemClick = (e: React.MouseEvent, view: string) => {
    e.stopPropagation();
    onCloseMenu();
    onNavigate(view);
  };

  const powerTools = [
    {
      icon: Magnet,
      label: isAutoGrouperEnabled ? 'Auto grouper' : 'Set-up auto grouper',
      className: `${styles.menuItem} ${styles.menuItemMagnet}`,
      iconClassName: isAutoGrouperEnabled ? styles.menuActiveIcon : '',
      onClick: (e: React.MouseEvent) => handleItemClick(e, 'autotabgrouperworker'),
    },
    {
      icon: Lightning,
      label: isAutoCloseEnabled ? 'Auto closer' : 'Set-up auto closer',
      className: `${styles.menuItem} ${styles.menuItemLightning}`,
      iconClassName: isAutoCloseEnabled ? styles.menuActiveIcon : '',
      onClick: (e: React.MouseEvent) => handleItemClick(e, 'autocloserworker'),
    },
    {
      icon: NetworkSlash,
      label: isAutoSmusherEnabled ? 'Auto smusher' : 'Set-up auto smusher',
      className: `${styles.menuItem} ${styles.menuItemSmush}`,
      iconClassName: isAutoSmusherEnabled ? styles.menuActiveIcon : '',
      onClick: (e: React.MouseEvent) => handleItemClick(e, 'autosmush'),
    },
    {
      icon: ListNumbers,
      label: isAutoSorterEnabled ? 'Auto sorter' : 'Set-up auto sorter',
      className: `${styles.menuItem} ${styles.menuItemSort}`,
      iconClassName: isAutoSorterEnabled ? styles.menuActiveIcon : '',
      onClick: (e: React.MouseEvent) => handleItemClick(e, 'tabsorter'),
    },
  ];

  const simpleMachines = [
    {
      icon: MagicWandIcon,
      label: 'Group tabs',
      className: `${styles.menuItem} ${styles.menuItemWand}`,
      onClick: (e: React.MouseEvent) => handleItemClick(e, 'autotabgroup'),
    },
    {
      icon: Bomb,
      label: 'Close old tabs',
      className: `${styles.menuItem} ${styles.menuItemBomb}`,
      onClick: (e: React.MouseEvent) => handleItemClick(e, 'autoclose'),
    },
    {
      icon: Broom,
      label: 'Clean bookmarks',
      className: `${styles.menuItem} ${styles.menuItemBomb}`,
      onClick: (e: React.MouseEvent) => handleItemClick(e, 'bookmarks'),
    },
    ...(hasYouTubeTabs
      ? [
          {
            icon: YoutubeLogo,
            label: 'Add to Watch Later',
            className: `${styles.menuItem} ${styles.menuItemYoutube}`,
            onClick: (e: React.MouseEvent) => handleItemClick(e, 'watchlater'),
          },
        ]
      : []),
  ];

  const settings = [
    {
      icon: Gear,
      label: 'Settings',
      className: styles.menuItem,
      onClick: (e: React.MouseEvent) => handleItemClick(e, 'settings'),
    },
  ];

  return (
    <>
      <ActionMenu sections={[{ items: powerTools }, { items: simpleMachines }]} />
      <div className={styles.menuDivider} />
      <ActionMenu items={settings} />
    </>
  );
}
