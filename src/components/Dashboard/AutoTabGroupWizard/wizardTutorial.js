// tutorial step definitions for the auto tab group wizard.
// each step targets a registered element by key and controls
// position, tooltip text, timing, and visual style.

export const ATG_TUTORIAL_KEY = 'atg_tutorial_done';

export const WIZARD_SEQUENCE = [
    {
        target: 'wiz-header',
        position: 'right',
        tooltipPosition: 'right',
        duration: 2000,
        color: 'var(--magic-dot)',
        pulse: true,
        size: 14,
        tooltip: 'This helps you group your open tabs by domain!',
    },
    {
        target: 'wiz-left',
        position: 'right',
        tooltipPosition: 'right',
        duration: 2000,
        color: 'var(--magic-dot)',
        pulse: true,
        size: 14,
        tooltip: 'Groups of tabs are on the right...',
    },
    {
        target: 'wiz-toggle',
        position: 'right',
        tooltipPosition: 'right',
        duration: 2000,
        color: 'var(--magic-dot)',
        pulse: true,
        size: 14,
        tooltip: 'and you can turn off grouping at the domain level.',
    },
    {
        target: 'wiz-right',
        position: 'left',
        tooltipPosition: 'right',
        duration: 2000,
        color: 'var(--magic-dot)',
        pulse: true,
        size: 14,
        tooltip: 'Toggle specific tabs with the checkboxes!',
    },
    {
        target: 'wiz-drag',
        position: 'right',
        tooltipPosition: 'right',
        duration: 3200,
        color: 'var(--magic-dot)',
        pulse: true,
        size: 14,
        tooltip: 'You can drag and drop any tab onto any group to configure custom groupings!',
    },
    {
        target: 'wiz-name',
        position: 'bottom',
        tooltipPosition: 'right',
        duration: 1000,
        color: 'var(--magic-dot)',
        pulse: true,
        size: 14,
        tooltip: 'Click to rename any group...',
    },
    {
        target: 'wiz-confirm',
        position: 'left',
        tooltipPosition: 'left',
        duration: 2500,
        color: 'var(--magic-dot)',
        pulse: true,
        size: 14,
        tooltip: "And here to run it!",
    },
];
