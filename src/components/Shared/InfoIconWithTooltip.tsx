import React, { useState, useRef } from 'react';
import { Info, IconWeight } from '@phosphor-icons/react';
import Tooltip from './Tooltip';

export interface InfoIconWithTooltipProps {
  children: React.ReactNode;
  size?: number;
  weight?: IconWeight;
  className?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export default function InfoIconWithTooltip({
  children,
  size = 16,
  weight = 'duotone',
  className,
  placement = 'right',
}: InfoIconWithTooltipProps) {
  const [hovered, setHovered] = useState<boolean>(false);
  const iconRef = useRef<HTMLSpanElement>(null);

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
