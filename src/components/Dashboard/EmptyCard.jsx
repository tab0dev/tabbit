import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTriage } from '../../store/TriageProvider';
import { useTimer } from '../../store/TimerProvider';
import { formatTime } from '../../utils/formatters';
import { Cake, Carrot, Clock, ConfettiIcon, Lightning } from '@phosphor-icons/react';
import styles from './EmptyCard.module.css';

export default function EmptyCard() {
  const { state } = useTriage();
  const { elapsed, pause } = useTimer();

  useEffect(() => {
    pause();
  }, [pause]);

  const counts = { keep: 0, close: 0, bookmark: 0, group: 0 };
  state.tabs.forEach(tab => {
    if (tab.action && counts[tab.action] !== undefined) {
      const tabWeight = 1 + (tab.duplicates?.length || 0);
      counts[tab.action] += tabWeight;
    }
  });

  const total = counts.keep + counts.close + counts.bookmark + counts.group;

  const pieData = [
    { id: 'keep', value: counts.keep, color: 'var(--green)', label: 'Kept' },
    { id: 'close', value: counts.close, color: 'var(--red)', label: 'Closed' },
    { id: 'bookmark', value: counts.bookmark, color: 'var(--orange)', label: 'Saved' },
    { id: 'group', value: counts.group, color: 'var(--purple)', label: 'Grouped' },
  ].filter(d => d.value > 0);

  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  let currentOffset = 0;

  // Zero-tab state: user opened the extension with nothing to triage
  if (total === 0) {
    return (
      <motion.div
        key="empty-stack-notabs"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={styles.emptyCard}
      >
        <div className={styles.emoji}><Carrot size={72} weight="duotone" color="#ff8800" /></div>
        <h2 className={styles.title}>Nothing to close... yet!</h2>
        <p className={styles.subtitle}>Go open a few hundred tabs and come back.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="empty-stack"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={styles.emptyCard}
    >
      <div className={styles.emoji}><ConfettiIcon size={72} weight="duotone" color="#e22ca9" /></div>
      <h2 className={styles.title}>Finished!</h2>
      <p className={styles.subtitle}>Easy peasy 🥕</p>

      {total > 0 && (
        <div className={styles.chartContainer}>
          <div className={styles.pieWrapper}>
            <svg width={size} height={size} className={styles.pieSvg}>
              {/* Background circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--border)"
                strokeWidth={strokeWidth}
                opacity={0.4}
              />
              {/* Data circles */}
              {pieData.map((slice) => {
                const slicePercent = slice.value / total;
                const dashFill = slicePercent * circumference;
                const gap = pieData.length > 1 ? 4 : 0;
                const adjustedDashFill = Math.max(0, dashFill - gap);

                const strokeDasharray = `${adjustedDashFill} ${circumference}`;
                const strokeDashoffset = -currentOffset * circumference;
                currentOffset += slicePercent;

                return (
                  <motion.circle
                    key={slice.id}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="butt"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    initial={{ strokeDasharray: `0 ${circumference}` }}
                    animate={{ strokeDasharray }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
                    className={styles.pieSlice}
                  />
                );
              })}
            </svg>
            <div className={styles.pieCenter}>
              <span className={styles.totalNumber}>{total}</span>
              <span className={styles.totalLabel}>Tabs</span>
            </div>
          </div>

          <div className={styles.legend}>
            {pieData.map(slice => (
              <div key={slice.id} className={styles.legendItem}>
                <div className={styles.legendLabelContainer}>
                  <div className={styles.legendDot} style={{ backgroundColor: slice.color }} />
                  <span className={styles.legendLabel}>{slice.label}</span>
                </div>
                <span className={styles.legendValue}>{Math.round((slice.value / total) * 100)}%</span>
              </div>
            ))}
            <hr style={{ borderColor: "var(--text-muted)", margin: "4px 0" }} />
            <div className={styles.legendItem}>
              <div className={styles.legendLabelContainer}>
                <Clock size={14} weight="bold" color="var(--text-secondary)" />
                <span className={styles.legendLabel}>Total Time</span>
              </div>
              <span className={styles.legendValue}>{formatTime(elapsed)}</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendLabelContainer}>
                <Lightning size={14} weight="bold" color="var(--text-secondary)" />
                <span className={styles.legendLabel}>Time Per Tab</span>
              </div>
              <span className={styles.legendValue}>{(elapsed / total).toFixed(1)}s</span>
            </div>
          </div>
        </div>
      )}

      <div className={styles.undoHint}>
        <kbd className={styles.kbd}>Z</kbd>
        <span>to undo last action</span>
      </div>
    </motion.div>
  );
}
