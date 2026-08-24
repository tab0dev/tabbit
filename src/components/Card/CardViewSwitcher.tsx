import React from 'react';
import styles from './Card.module.css';
import SettingsCard from '../Tools/Settings/SettingsCard';
import MusicDevTrackerCard from '../Tools/MusicDev/MusicDevTrackerCard';
import CloseOldTabsCard from '../Tools/CloseOldTabs/CloseOldTabsCard';
import AutoTabCloserPanel from '../Tools/AutoTabCloser/AutoTabCloserPanel';
import ManualTabGroupWizard from '../Tools/TabGroupWizard/ManualTabGroupWizard';
import AutoTabGrouperPanel from '../Tools/AutoTabGrouper/AutoTabGrouperPanel';
import AutoSmusherPanel from '../Tools/AutoSmusher/AutoSmusherPanel';
import TabCard from './TabCard';
import AutoSorterPanel from '../Tools/AutoSorter/AutoSorterPanel';
import WatchLaterCard from '../Tools/WatchLater/WatchLaterCard';
import ListView from '../Tools/ListView/ListView';
import BookmarkManagerCard from '../Tools/BookmarkManager/BookmarkManagerCard';
import { TriageTab, TabGroup } from '../../types';
import { MotionValue } from 'framer-motion';

export interface CardViewSwitcherProps {
  activeView: string;
  isReordering: boolean;
  tab: TriageTab;
  isTop: boolean;
  bgColor: MotionValue<string> | string;
  domain: string;
  tabGroup: TabGroup | null;
  groupColor: string | null;
  handleNavigate: (view: string) => void;
  handleCardClick: (e: React.MouseEvent) => void;
  keepOpacity: MotionValue<number>;
  closeOpacity: MotionValue<number>;
  stampScale: MotionValue<number>;
}

export default function CardViewSwitcher({
  activeView,
  isReordering,
  tab,
  isTop,
  bgColor,
  domain,
  tabGroup,
  groupColor,
  handleNavigate,
  handleCardClick,
  keepOpacity,
  closeOpacity,
  stampScale,
}: CardViewSwitcherProps) {
  if (isTop && activeView === 'settings') {
    return <SettingsCard handleNavigate={handleNavigate} />;
  }

  if (isTop && activeView === 'autoclose') {
    return <CloseOldTabsCard onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'musicdev') {
    return <MusicDevTrackerCard onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'autocloserworker') {
    return <AutoTabCloserPanel onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'autotabgroup') {
    return <ManualTabGroupWizard onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'autotabgrouperworker') {
    return <AutoTabGrouperPanel onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'tabsorter') {
    return <AutoSorterPanel onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'listview') {
    return <ListView onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'bookmarks') {
    return <BookmarkManagerCard />;
  }

  if (isTop && activeView === 'watchlater') {
    return <WatchLaterCard onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'autosmush') {
    return <AutoSmusherPanel onClose={() => handleNavigate('default')} />;
  }

  if (isReordering) {
    return (
      <div className={styles.preview}>
        <div className={styles.previewLoading}>Reordering tabs…</div>
      </div>
    );
  }

  return (
    <TabCard
      tab={tab}
      isTop={isTop}
      bgColor={bgColor}
      domain={domain}
      tabGroup={tabGroup}
      groupColor={groupColor}
      handleCardClick={handleCardClick}
      keepOpacity={keepOpacity}
      closeOpacity={closeOpacity}
      stampScale={stampScale}
    />
  );
}
