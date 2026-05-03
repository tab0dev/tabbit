/**
 * Shared tab age thresholds used by both AutoCloseCard and
 * AutoTabCloserWorkerPanel. Centralised here so both components
 * and the useAutoCloser hook reference the exact same values.
 */
export const THRESHOLDS = [
  { value: 'now',        label: 'Now',       ms: -1 },
  { value: '5_minutes',  label: '5 Minutes', ms: 1000 * 60 * 5 },
  { value: '30_minutes', label: '30 Minutes',ms: 1000 * 60 * 30 },
  { value: '1_hour',     label: '1 Hour',    ms: 1000 * 60 * 60 },
  { value: '3_hours',    label: '3 Hours',   ms: 1000 * 60 * 60 * 3 },
  { value: '6_hours',    label: '6 Hours',   ms: 1000 * 60 * 60 * 6 },
  { value: '12_hours',   label: '12 Hours',  ms: 1000 * 60 * 60 * 12 },
  { value: '1_day',      label: '1 Day',     ms: 1000 * 60 * 60 * 24 },
  { value: '2_days',     label: '2 Days',    ms: 1000 * 60 * 60 * 24 * 2 },
  { value: '3_days',     label: '3 Days',    ms: 1000 * 60 * 60 * 24 * 3 },
  { value: '4_days',     label: '4 Days',    ms: 1000 * 60 * 60 * 24 * 4 },
  { value: '5_days',     label: '5 Days',    ms: 1000 * 60 * 60 * 24 * 5 },
  { value: '6_days',     label: '6 Days',    ms: 1000 * 60 * 60 * 24 * 6 },
  { value: '7_days',     label: '1 Week',    ms: 1000 * 60 * 60 * 24 * 7 },
  { value: '10_days',    label: '10 Days',   ms: 1000 * 60 * 60 * 24 * 10 },
  { value: '2_weeks',    label: '2 Weeks',   ms: 1000 * 60 * 60 * 24 * 14 },
  { value: '3_weeks',    label: '3 Weeks',   ms: 1000 * 60 * 60 * 24 * 21 },
  { value: '1_month',    label: '1 Month',   ms: 1000 * 60 * 60 * 24 * 30 },
  { value: '2_months',   label: '2 Months',  ms: 1000 * 60 * 60 * 24 * 60 },
];

/**
 * The subset of thresholds meaningful for the auto-closer worker
 * (excludes "Now" which only makes sense in the manual close flow).
 */
export const AUTO_CLOSER_THRESHOLDS = THRESHOLDS.filter(t => t.value !== 'now');

/**
 * Translate a stored millisecond value back to a THRESHOLDS entry.
 * Falls back to the 7-day entry if no exact match is found.
 */
export function thresholdFromMs(ms) {
  return THRESHOLDS.find(t => t.ms === ms)
    ?? THRESHOLDS.find(t => t.value === '7_days');
}
