import React from 'react';
// Intentionally imports the picker-panel CSS module — this component is
// purpose-built for the picker panels and shares their design tokens.
import styles from '../Dashboard/PickerPanels.module.css';

export interface PickerHoverItemProps {
  /** Whether this item is currently keyboard-selected */
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  /** Left-side icon node (emoji span, color dot, etc.) */
  icon: React.ReactNode;
  /** The item label / name */
  label: string;
  /** Muted text prepended before the label on hover. e.g. "Save to", "Move to" */
  prefix?: string;
  /** Muted text appended after the label on hover, before the arrow. e.g. "and close" */
  suffix?: string;
  /**
   * Optional breadcrumb / path string shown at the right when NOT hovering.
   * Hidden while hovering (replaced by the action hint).
   */
  path?: string;
}

/**
 * A flat picker list item (<li>) that reveals a contextual action hint on hover:
 *   [prefix] [label] [suffix] →
 * making the click action obvious to first-time users.
 */
export default function PickerHoverItem({
  isSelected,
  onClick,
  onMouseEnter,
  icon,
  label,
  prefix,
  suffix,
  path,
}: PickerHoverItemProps) {
  return (
    <li
      data-selected={isSelected ? 'true' : 'false'}
      className={`${styles.pickerItem} ${isSelected ? styles.pickerItemSelected : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseEnter}
    >
      {icon}
      <span className={styles.pickerItemLabel}>
        {isSelected ? (
          <>
            {prefix && <span className={styles.pickerHoverPrefix}>{prefix} </span>}
            {label}
            {suffix && <span className={styles.pickerHoverSuffix}> {suffix}</span>}
            <span className={styles.pickerHoverArrow}>&rarr;</span>
          </>
        ) : (
          label
        )}
      </span>
      {!isSelected && path && <span className={styles.pickerItemPath}>{path}</span>}
    </li>
  );
}
