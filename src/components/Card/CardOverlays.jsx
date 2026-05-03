import React from 'react';
import { motion } from 'framer-motion';
import styles from './Card.module.css';

export default function CardOverlays({ keepOpacity, closeOpacity, stampScale }) {
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
