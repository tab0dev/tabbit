import React, { useEffect, useState, useRef } from 'react';
import { useMagicDot } from './MagicDotProvider';
import styles from './MagicDot.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { EllipsisIcon } from './LoaderDots';

/**
 * @typedef {import('./types').CardinalDirection} CardinalDirection
 * @typedef {import('./types').MagicDotStep} MagicDotStep
 */

const getCoordinatesForPosition = (rect, position) => {
  let x = rect.left + rect.width / 2;
  let y = rect.top + rect.height / 2;

  switch (position) {
    case 'top-left':
      x = rect.left;
      y = rect.top;
      break;
    case 'top':
      y = rect.top;
      break;
    case 'top-right':
      x = rect.right;
      y = rect.top;
      break;
    case 'right':
      x = rect.right;
      break;
    case 'bottom-right':
      x = rect.right;
      y = rect.bottom;
      break;
    case 'bottom':
      y = rect.bottom;
      break;
    case 'bottom-left':
      x = rect.left;
      y = rect.bottom;
      break;
    case 'left':
      x = rect.left;
      break;
    case 'center':
    default:
      break;
  }

  return { x, y };
};

/**
 * @param {{ sequence: MagicDotStep[], onSequenceComplete?: () => void, autoStart?: boolean, introDelay?: number, fixedMode?: boolean }} props
 */
export default function MagicDot({ sequence = [], onSequenceComplete, autoStart = true, introDelay = 0, fixedMode = false }) {
  const { subscribeTarget } = useMagicDot();
  const [activeStep, setActiveStep] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [showTooltip, setShowTooltip] = useState(false);
  const dotRef = useRef(null);
  const currentStepRef = useRef(-1);

  useEffect(() => {
    if (!autoStart || sequence.length === 0) return;

    let destroyed = false;
    let timerId;
    let unsubscribe;

    const runSequence = async () => {
      if (introDelay > 0) {
        await new Promise(r => { timerId = setTimeout(r, introDelay); });
        if (destroyed) return;
      }

      for (let i = 0; i < sequence.length; i++) {
        currentStepRef.current = i;
        const step = sequence[i];
        
        setShowTooltip(false);
        
        let targetEl = await new Promise(resolve => {
           unsubscribe = subscribeTarget(step.target, resolve);
        });
        if (unsubscribe) unsubscribe();
        unsubscribe = null;
        if (destroyed) return;

        let rect = targetEl.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
           await new Promise(r => requestAnimationFrame(r));
           if (destroyed) return;
           rect = targetEl.getBoundingClientRect();
        }

        const baseCoords = getCoordinatesForPosition(rect, step.position);
        const x = baseCoords.x + (step.offsetX || 0);
        const y = baseCoords.y + (step.offsetY || 0);
        const dotSize = step.size || 24;
        
        setActiveStep(step);
        setActiveStepIndex(i);

        // Wait a tick so React has time to mount the DOM node if it's the first step
        await new Promise(r => requestAnimationFrame(r));
        if (destroyed) return;

        const dotElement = dotRef.current;
        const duration = step.transitionDuration !== undefined ? step.transitionDuration : 500;
        const moveWait = i > 0 ? duration : 0;
        
        if (dotElement) {
          // Use a spring-like cubic-bezier as default for a more playful, natural feel
          const easing = step.easing || 'cubic-bezier(0.34, 1.56, 0.64, 1)';
          
          if (i > 0) {
            dotElement.style.transition = `transform ${duration}ms ${easing}`;
          } else {
            dotElement.style.transition = 'none';
          }
          
          dotElement.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
          dotElement.style.width = `${dotSize}px`;
          dotElement.style.height = `${dotSize}px`;
          dotElement.style.backgroundColor = step.color || 'var(--accent)';
          Object.assign(dotElement.style, step.style || {});
          
          if (step.pulse) {
             dotElement.classList.add(styles.pulse);
          } else {
             dotElement.classList.remove(styles.pulse);
          }
        }

        if (moveWait > 0) {
          await new Promise(r => { timerId = setTimeout(r, moveWait); });
          if (destroyed) return;
        }

        setShowTooltip(true);

        if (step.onEnter) {
          step.onEnter();
        }

        if (step.duration) {
          const waitTime = Math.max(0, step.duration - moveWait);
          await new Promise(r => { timerId = setTimeout(r, waitTime); });
          if (destroyed) return;
        }
      }

      currentStepRef.current = sequence.length;
      if (onSequenceComplete) onSequenceComplete();
      setActiveStep(null);
      setShowTooltip(false);
    };

    runSequence();

    return () => {
      destroyed = true;
      if (timerId) clearTimeout(timerId);
      if (unsubscribe) unsubscribe();
    };
  }, [sequence, subscribeTarget, autoStart, introDelay, onSequenceComplete, fixedMode]);

  useEffect(() => {
    const handleResize = () => {
      const i = currentStepRef.current;
      if (i >= 0 && i < sequence.length) {
        const step = sequence[i];
        const unsubs = subscribeTarget(step.target, (targetEl) => {
           if (!targetEl || !dotRef.current) return;
           const rect = targetEl.getBoundingClientRect();
           const baseCoords = getCoordinatesForPosition(rect, step.position);
           const x = baseCoords.x + (step.offsetX || 0);
           const y = baseCoords.y + (step.offsetY || 0);
           dotRef.current.style.transition = 'none';
           dotRef.current.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
        });
        unsubs();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sequence, subscribeTarget]);

  if (!activeStep || currentStepRef.current >= sequence.length) return null;

  return (
    <>
      <div ref={dotRef} className={styles.magicDot}>
        {!fixedMode && activeStep.tooltip && showTooltip && (
          <div className={styles.tooltip} data-position={activeStep.tooltipPosition || 'bottom'}>
            {activeStep.tooltip}
          </div>
        )}
      </div>
      {fixedMode && (
        <motion.div 
          layout
          initial={{ opacity: 0, y: 10, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 10, x: '-50%' }}
          style={{ x: '-50%' }}
          transition={{ layout: { type: 'spring', bounce: 0, duration: 0.4 } }}
          className={`${styles.tooltip} ${styles.fixedTooltip}`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {activeStep.tooltip ? (
              <motion.div
                key={activeStepIndex}
                initial={{ opacity: 0, filter: 'blur(4px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(4px)', scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {activeStep.tooltip}
              </motion.div>
            ) : (
              <motion.div
                key="loader"
                initial={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.5, filter: 'blur(4px)' }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <EllipsisIcon size={20} ref={(node) => node && node.startAnimation()} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}
