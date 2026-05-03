/**
 * Shared types for the generic Magic Dot tutorial wizard.
 */

export type CardinalDirection = 
  | 'center'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'
  | 'top-left';

export interface MagicDotStep {
  /** Target element identifier registered with useMagicDot */
  target: string;
  /** Positioning of the Magic Dot around the target element bounds */
  position?: CardinalDirection;
  /** Positioning of the Tooltip popover relative to the Magic Dot itself */
  tooltipPosition?: CardinalDirection;
  /** Duration to stay at this target before advancing (optional, default depends on manual advance or timeouts) */
  duration?: number;
  /** Background color for the Magic Dot */
  color?: string;
  /** Should the Magic Dot continuously pulse its shadow ring? */
  pulse?: boolean;
  /** Dimensions of the central Magic Dot */
  size?: number;
  /** Text to render in the tooltip popup */
  tooltip?: string;
  /** Manual X offset additive to the auto-calculated bounding coordinates */
  offsetX?: number;
  /** Manual Y offset additive to the auto-calculated bounding coordinates */
  offsetY?: number;
  /** Triggered hook when the pointer enters this step */
  onEnter?: () => void;
}
