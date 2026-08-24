import React, { useState } from 'react';
import { Globe } from '@phosphor-icons/react';
import styles from './Card.module.css';
import { TriageTab } from '../../types';

export interface CardHeaderProps {
  tab: TriageTab;
  domain: string;
}

export default function CardHeader({ tab, domain }: CardHeaderProps) {
  const [imgError, setImgError] = useState<boolean>(false);

  return (
    <div className={styles.faviconRow}>
      {tab.favIconUrl && !imgError ? (
        <img
          src={tab.favIconUrl}
          className={styles.favicon}
          alt=""
          width="24"
          height="24"
          draggable="false"
          onError={() => setImgError(true)}
        />
      ) : (
        <Globe size={24} weight="regular" className={styles.favicon} />
      )}
      <span className={styles.domain}>{domain}</span>
    </div>
  );
}
