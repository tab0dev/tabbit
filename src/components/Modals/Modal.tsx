import React from 'react';
import styles from '../Dashboard/PickerPanels.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className={styles.pickerOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className={styles.pickerModal}>{children}</div>
    </div>
  );
}
