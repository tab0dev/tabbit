import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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

// Timing-aware dim background transition: stays short even on brief steps,
// and tightens up proportionally when the step itself is very short.
const getDimAnimMs = (step) => Math.min(200, Math.max(80, (step.duration || 2500) / 8));

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
  const tooltipRef = useRef(null);

  const adjustTooltipBounds = (x, y, step) => {
    if (!tooltipRef.current) return;
    const tooltipEl = tooltipRef.current;
    const pos = step.tooltipPosition || 'bottom';
    const dotSize = step.size || 24;
    const MARGIN = 32; // 16px css margin + 16px edge padding
    
    let maxWidth = 300;
    if (pos.includes('right')) {
      maxWidth = window.innerWidth - x - (dotSize / 2) - MARGIN;
    } else if (pos.includes('left')) {
      maxWidth = x - (dotSize / 2) - MARGIN;
    } else {
      maxWidth = window.innerWidth - MARGIN;
    }
    
    maxWidth = Math.max(120, maxWidth);
    tooltipEl.style.setProperty('--max-tooltip-width', `${maxWidth}px`);
    
    // reset shifts to calculate natural bounding box
    tooltipEl.style.setProperty('--shift-x', '0px');
    tooltipEl.style.setProperty('--shift-y', '0px');
    
    const rect = tooltipEl.getBoundingClientRect();
    let shiftX = 0;
    let shiftY = 0;
    
    if (rect.right > window.innerWidth - 16) {
      shiftX = (window.innerWidth - 16) - rect.right;
    } else if (rect.left < 16) {
      shiftX = 16 - rect.left;
    }
    
    if (rect.bottom > window.innerHeight - 16) {
      shiftY = (window.innerHeight - 16) - rect.bottom;
    } else if (rect.top < 16) {
      shiftY = 16 - rect.top;
    }
    
    if (shiftX !== 0) tooltipEl.style.setProperty('--shift-x', `${shiftX}px`);
    if (shiftY !== 0) tooltipEl.style.setProperty('--shift-y', `${shiftY}px`);
  };

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
        
        const targetTimeout = step.timeout !== undefined ? step.timeout : 2500;
        let targetEl = await new Promise(resolve => {
          let resolved = false;
          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              console.warn(`[MagicDot] target '${step.target}' never appeared within ${targetTimeout}ms — skipping step`);
              resolve(null);
            }
          }, targetTimeout);
          unsubscribe = subscribeTarget(step.target, (node) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              resolve(node);
            }
          });
        });
        if (unsubscribe) unsubscribe();
        unsubscribe = null;
        if (destroyed) return;
        if (!targetEl) continue;

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
        
        await new Promise(r => requestAnimationFrame(r));
        if (destroyed) return;
        adjustTooltipBounds(x, y, step);

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
           
           adjustTooltipBounds(x, y, step);
        });
        unsubs();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sequence, subscribeTarget]);

  if (!activeStep || currentStepRef.current >= sequence.length) return null;

  return createPortal(
    <>
      <div ref={dotRef} className={styles.magicDot}>
        {!fixedMode && activeStep.tooltip && showTooltip && (
          <div
            ref={tooltipRef}
            className={`${styles.tooltip}${activeStep.dimBackground ? ` ${styles.tooltipDim}` : ''}`}
            data-position={activeStep.tooltipPosition || 'bottom'}
            style={activeStep.dimBackground ? { '--tooltip-anim': `${getDimAnimMs(activeStep)}ms` } : undefined}
          >
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
    </>,
    document.body
  );
}
