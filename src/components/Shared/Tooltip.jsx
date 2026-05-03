import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

export default function Tooltip({
    children,
    anchorRef,
    visible = false,
    placement = 'top', // 'top' | 'bottom' | 'left' | 'right'
    offset = 8,
}) {
    const [shouldRender, setShouldRender] = useState(false);
    const [position, setPosition] = useState(null);
    const tooltipRef = useRef(null);

    // Mount/unmount logic
    useEffect(() => {
        let timeout;
        if (visible) {
            setShouldRender(true);
            if (timeout) clearTimeout(timeout);
        } else {
            timeout = setTimeout(() => {
                setShouldRender(false);
                setPosition(null);
            }, 200); // match transition duration
        }
        return () => clearTimeout(timeout);
    }, [visible]);

    // Positioning layout calculation
    useLayoutEffect(() => {
        if (!shouldRender || !anchorRef?.current || !tooltipRef.current) return;

        const updatePosition = () => {
            if (!anchorRef.current || !tooltipRef.current) return;
            const anchor = anchorRef.current.getBoundingClientRect();
            const tooltip = tooltipRef.current.getBoundingClientRect();
            
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let actualPlacement = placement;

            // Simple boundary detection to flip placement if out of viewport
            if (actualPlacement === 'top' && anchor.top - tooltip.height - offset < 0) {
                actualPlacement = 'bottom';
            } else if (actualPlacement === 'bottom' && anchor.bottom + tooltip.height + offset > viewportHeight) {
                actualPlacement = 'top';
            } else if (actualPlacement === 'left' && anchor.left - tooltip.width - offset < 0) {
                actualPlacement = 'right';
            } else if (actualPlacement === 'right' && anchor.right + tooltip.width + offset > viewportWidth) {
                actualPlacement = 'left';
            }

            let x = 0;
            let y = 0;
            let arrowX = '50%';
            let arrowY = '50%';

            // Standard coordinate anchoring
            switch (actualPlacement) {
                case 'top':
                    x = anchor.left + (anchor.width / 2) - (tooltip.width / 2);
                    y = anchor.top - tooltip.height - offset;
                    break;
                case 'bottom':
                    x = anchor.left + (anchor.width / 2) - (tooltip.width / 2);
                    y = anchor.bottom + offset;
                    break;
                case 'left':
                    x = anchor.left - tooltip.width - offset;
                    y = anchor.top + (anchor.height / 2) - (tooltip.height / 2);
                    break;
                case 'right':
                    x = anchor.right + offset;
                    y = anchor.top + (anchor.height / 2) - (tooltip.height / 2);
                    break;
            }

            // Boundary constraints for secondary axis (X when top/bottom, Y when left/right)
            const PADDING = 8;
            if (actualPlacement === 'top' || actualPlacement === 'bottom') {
                if (x < PADDING) {
                    const shift = PADDING - x;
                    x = PADDING;
                    arrowX = `calc(50% - ${shift}px)`;
                } else if (x + tooltip.width > viewportWidth - PADDING) {
                    const shift = (x + tooltip.width) - (viewportWidth - PADDING);
                    x = viewportWidth - PADDING - tooltip.width;
                    arrowX = `calc(50% + ${shift}px)`;
                }
            } else {
                if (y < PADDING) {
                    const shift = PADDING - y;
                    y = PADDING;
                    arrowY = `calc(50% - ${shift}px)`;
                } else if (y + tooltip.height > viewportHeight - PADDING) {
                    const shift = (y + tooltip.height) - (viewportHeight - PADDING);
                    y = viewportHeight - PADDING - tooltip.height;
                    arrowY = `calc(50% + ${shift}px)`;
                }
            }

            setPosition({ x, y, actualPlacement, arrowX, arrowY });
        };

        // run exactly once to seed initial measurement coords, then wire listeners
        updatePosition();

        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [shouldRender, placement, offset, anchorRef, children]);

    if (!shouldRender || typeof document === 'undefined') return null;

    // only show it once measured and positioned, preventing messy fly-in transitions.
    const isReady = visible && position;

    return createPortal(
        <div
            ref={tooltipRef}
            className={`${styles.tooltip} ${isReady ? styles.visible : ''}`}
            style={{ 
                left: position ? position.x : 0,
                top: position ? position.y : 0,
                visibility: position ? 'visible' : 'hidden',
                transform: `scale(${isReady ? 1 : 0.96})`,
                '--arrow-x': position ? position.arrowX : '50%',
                '--arrow-y': position ? position.arrowY : '50%',
            }}
            data-placement={position?.actualPlacement || placement}
        >
            {children}
            <div className={styles.arrow} />
        </div>,
        document.body
    );
}
