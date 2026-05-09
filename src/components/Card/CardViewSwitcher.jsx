import React from 'react';
import styles from './Card.module.css';
import SettingsCard from './SettingsCard';
import MusicDevTrackerCard from './MusicDevTrackerCard/MusicDevTrackerCard';
import AutoCloseCard from './AutoCloseCard/AutoCloseCard';
import AutoTabCloserWorkerPanel from './AutoTabCloserWorkerCard/AutoTabCloserWorkerPanel';
import AutoTabGroupWizard from '../Dashboard/AutoTabGroupWizard';
import AutoTabGrouperWorkerPanel from './AutoTabGrouperWorkerCard/AutoTabGrouperWorkerPanel';
import TabCard from './TabCard';
import TabSorterCard from './TabSorterCard/TabSorterCard';
import WatchLaterCard from './WatchLaterCard/WatchLaterCard';
import ListView from './ListView/ListView';

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
  stampScale
}) {
  if (isTop && activeView === 'settings') {
    return <SettingsCard handleNavigate={handleNavigate} />;
  }

  if (isTop && activeView === 'autoclose') {
    return <AutoCloseCard onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'musicdev') {
    return <MusicDevTrackerCard onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'autocloserworker') {
    return <AutoTabCloserWorkerPanel onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'autotabgroup') {
    return <AutoTabGroupWizard onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'autotabgrouperworker') {
    return <AutoTabGrouperWorkerPanel onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'tabsorter') {
    return <TabSorterCard />;
  }

  if (isTop && activeView === 'listview') {
    return <ListView onClose={() => handleNavigate('default')} />;
  }

  if (isTop && activeView === 'watchlater') {
    return <WatchLaterCard onClose={() => handleNavigate('default')} />;
  }

  if (isReordering) {
    return (
      <div className={styles.preview}>
        <div className={styles.previewLoading}>
          Reordering tabs…
        </div>
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
