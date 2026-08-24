import React from 'react';
import { motion } from 'framer-motion';
import styles from './Card.module.css';
import CardHeader from './CardHeader';
import CardPills from './CardPills';
import CardOverlays from './CardOverlays';
import PreviewPanel from './PreviewPanel';
import { TriageTab, TabGroup } from '../../types';
import { MotionValue } from 'framer-motion';

export interface TabCardProps {
  tab: TriageTab;
  isTop: boolean;
  bgColor: MotionValue<string> | string;
  domain: string;
  tabGroup: TabGroup | null;
  groupColor: string | null;
  handleCardClick: (e: React.MouseEvent) => void;
  keepOpacity: MotionValue<number>;
  closeOpacity: MotionValue<number>;
  stampScale: MotionValue<number>;
}

export default function TabCard({
  tab,
  isTop,
  bgColor,
  domain,
  tabGroup,
  groupColor,
  handleCardClick,
  keepOpacity,
  closeOpacity,
  stampScale,
}: TabCardProps) {
  return (
    <>
      <motion.div
        className={styles.cardDetails}
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        style={{ backgroundColor: isTop ? bgColor : 'transparent' }}
      >
        <CardHeader tab={tab} domain={domain} />

        <CardPills tab={tab} tabGroup={tabGroup} groupColor={groupColor} />

        <h1 className={styles.title}>{tab.title}</h1>
        <p className={styles.url}>{tab.url}</p>
      </motion.div>

      {isTop && (
        <CardOverlays
          keepOpacity={keepOpacity}
          closeOpacity={closeOpacity}
          stampScale={stampScale}
        />
      )}

      <PreviewPanel tab={tab} />
    </>
  );
}
