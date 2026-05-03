import React from 'react';
import { createPortal } from 'react-dom';
import styles from './Card.module.css';
import CardActionMenu from './CardActionMenu';

export default function CardActionPortal({ menuRect, onNavigate, onClose }) {
  if (!menuRect) return null;

  return createPortal(
    <div className={styles.menuPortalOverlay} onClick={onClose}>
      <div
        className={styles.menuPopoverPortal}
        onClick={(e) => e.stopPropagation()}
        style={{
          '--btn-top': `${menuRect.top}px`,
          '--btn-right': `${window.innerWidth - menuRect.right}px`,
          '--btn-bottom': `${window.innerHeight - menuRect.bottom}px`,
          '--btn-left': `${menuRect.left}px`,
          '--btn-width': `${menuRect.width}px`,
          '--btn-height': `${menuRect.height}px`,
        }}
      >
        <CardActionMenu 
          onNavigate={onNavigate} 
          onCloseMenu={onClose} 
        />
      </div>
    </div>,
    document.body
  );
}
