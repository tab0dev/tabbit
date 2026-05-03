import React from 'react';

const ICONS = {
  keep: {
    title: 'Keep',
    viewBox: '0 0 16 16',
    svg: (
      <>
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="5.5" cy="6.6" r="1.1" fill="currentColor" />
        <circle cx="10.5" cy="6.6" r="1.1" fill="currentColor" />
        <path
          d="M5 10.2c1.1 1.3 4.0 1.3 6 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  bookmark: {
    title: 'Bookmark',
    viewBox: '0 0 16 16',
    svg: (
      <>
        <path
          d="M4.2 2.8h7.6c.6 0 1 .4 1 1v10.4l-4.8-2.3-4.8 2.3V3.8c0-.6.4-1 1-1z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 2.9l7.1 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </>
    ),
  },
  group: {
    title: 'Group',
    viewBox: '0 0 16 16',
    svg: (
      <>
        <rect
          x="3.3"
          y="5.2"
          width="9.4"
          height="8.2"
          rx="1.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M3.9 5.2V3.4c0-.5.4-.9.9-.9h6.4c.5 0 .9.4.9.9v1.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="6.1" cy="9.1" r="1.0" fill="currentColor" />
        <circle cx="8.0" cy="9.1" r="1.0" fill="currentColor" />
        <circle cx="9.9" cy="9.1" r="1.0" fill="currentColor" />
      </>
    ),
  },
  close: {
    title: 'Close',
    viewBox: '0 0 16 16',
    svg: (
      <>
        <path
          d="M4.3 4.3l7.4 7.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M11.7 4.3l-7.4 7.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </>
    ),
  },
};

export default function RetroActionIcon({ iconId, title }) {
  if (!iconId) return null;
  const def = ICONS[iconId] || null;
  if (!def) return null;

  const ariaLabel = title || def.title || iconId;
  return (
    <svg
      viewBox={def.viewBox}
      width="16"
      height="16"
      role="img"
      aria-label={ariaLabel}
      focusable="false"
      style={{ display: 'block' }}
    >
      {def.svg}
    </svg>
  );
}

