import React from 'react';
import styles from './Overlay.module.css';

export default function Modal({ isOpen, onClose, children }) {
    if (!isOpen) return null;

    return (
        <div className={styles.pickerOverlay} onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
            <div className={styles.pickerModal}>
                {children}
            </div>
        </div>
    );
}
