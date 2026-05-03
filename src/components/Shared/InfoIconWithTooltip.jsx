import React, { useState, useRef } from 'react';
import { Info } from '@phosphor-icons/react';
import Tooltip from './Tooltip';

export default function InfoIconWithTooltip({ children, size = 16, weight = "duotone", className, placement = "right" }) {
    const [hovered, setHovered] = useState(false);
    const iconRef = useRef(null);

    return (
        <>
            <span
                ref={iconRef}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help', marginLeft: '6px' }}
                className={className}
            >
                <Info size={size} weight={weight} color="var(--text-secondary)" />
            </span>
            <Tooltip anchorRef={iconRef} visible={hovered} placement={placement}>
                {children}
            </Tooltip>
        </>
    );
}
