import React from 'react';
import { motion, MotionValue } from 'framer-motion';
import styles from './Card.module.css';

export interface CardOverlaysProps {
  keepOpacity: MotionValue<number>;
  closeOpacity: MotionValue<number>;
  stampScale: MotionValue<number>;
}

export default function CardOverlays({ keepOpacity, closeOpacity, stampScale }: CardOverlaysProps) {
  return (
    <>
      <motion.div
        className={`${styles.overlay} ${styles.keepOverlay}`}
        style={{ opacity: keepOpacity, scale: stampScale }}
      >
        ✔
      </motion.div>
      <motion.div
        className={`${styles.overlay} ${styles.closeOverlay}`}
        style={{ opacity: closeOpacity, scale: stampScale }}
      >
        ✖
      </motion.div>
    </>
  );
}
