import React from 'react';
import styles from './Card.module.css';

export default function CardHeader({ tab, domain }) {
  return (
    <div className={styles.faviconRow}>
      {tab.favIconUrl && (
        <img
          src={tab.favIconUrl}
          className={styles.favicon}
          alt=""
          width="24"
          height="24"
          draggable="false"
        />
      )}
      <span className={styles.domain}>{domain}</span>
    </div>
  );
}
