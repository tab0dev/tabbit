import React from 'react';
import styles from '../ListView/ListView.module.css';
import { useMagicDot } from '../../Tutorial/MagicDotProvider';

// Reuses ListView.module.css entirely — same sidebar visual language.

const SORT_OPTIONS = [
  { value: 'manual', label: 'Original Order' },
  { value: 'lastActivity', label: 'Date Used' },
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'title', label: 'A → Z' },
];

const FOLDER_FILTERS = [
  { value: 'all', label: 'All Bookmarks' },
  { value: 'bookmarks-bar', label: 'Bookmarks Bar' },
  { value: 'other', label: 'Other' },
  { value: 'mobile', label: 'Mobile' },
];

// Checks dateLastUsed — access-based filters
const ACCESS_FILTER_OPTIONS = [
  { value: 'all', label: 'Any' },
  { value: 'never-used', label: 'Never Used' },
  { value: 'recent', label: 'Used this week' },
  { value: 'recent-1m', label: 'Used this month' },
  { value: 'stale-6m', label: 'Not used in 6 months' },
  { value: 'stale-1y', label: 'Not used in 1 year' },
];

// Checks dateAdded — creation-age filters
const AGE_FILTER_OPTIONS = [
  { value: 'all', label: 'Any' },
  { value: 'added-1w', label: 'Added this week' },
  { value: 'added-1m', label: 'Added this month' },
  { value: '1w', label: 'Older than 1 week' },
  { value: '1m', label: 'Older than 1 month' },
  { value: '6m', label: 'Older than 6 months' },
  { value: '1y', label: 'Older than 1 year' },
  { value: '2y', label: 'Older than 2 years' },
  { value: '3y', label: 'Older than 3 years' },
  { value: '5y', label: 'Older than 5 years' },
];

const CONTENT_FILTER_OPTIONS = [
  { value: 'all', label: 'Any' },
  { value: 'no-title', label: 'No Title' },
  { value: 'deep-nested', label: 'Nested folders' }, // used to be called Deeply nested
  { value: 'empty-folder', label: 'Empty folders' },
  { value: 'duplicates', label: 'Duplicates' },
];

/**
 * BookmarkManagerSidebar
 *
 * Mirrors ListViewSidebar visually and structurally.
 * Sort options are bookmark-specific (Date Used, date added, title, manual).
 * Two independent filter sections:
 *   "Date Used"   — access-based (never used / used this week / this month / stale)
 *   "Date Added"  — creation-age (added recently / older than N)
 *   "Content"     — structural quality (no title)
 * All compose with the folder-scope "Show" filter.
 */
export default function BookmarkManagerSidebar({
  sortMode,
  sortAsc,
  onSortChange,
  folderFilter,
  onFolderFilterChange,
  accessFilter,
  onAccessFilterChange,
  ageFilter,
  onAgeFilterChange,
  contentFilter,
  onContentFilterChange,
  totalCount,
  coldCount,
}) {
  const { registerTarget } = useMagicDot();

  return (
    <div className={styles.sidebar}>

      {/* Sort */}
      <div className={styles.sidebarSection}>
        <div className={styles.sidebarSectionTitle}>Sort</div>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`${styles.sidebarItem} ${sortMode === opt.value ? styles.sidebarItemActive : ''}`}
            onClick={() => onSortChange(opt.value)}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opt.label}
            </span>
            {sortMode === opt.value && (
              <span style={{ fontSize: 10, flexShrink: 0, marginLeft: 4, opacity: 0.8 }}>
                {sortAsc ? '↑' : '↓'}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Date Used filter */}
      <div className={styles.sidebarSection}>
        <div className={styles.sidebarSectionTitle} ref={registerTarget('bm-date-used')}>Date Used</div>
        {ACCESS_FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`${styles.sidebarItem} ${accessFilter === opt.value ? styles.sidebarItemActive : ''}`}
            onClick={() => onAccessFilterChange(opt.value)}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>

      {/* Date Added filter */}
      <div className={styles.sidebarSection}>
        <div className={styles.sidebarSectionTitle} ref={registerTarget('bm-date-added')}>Date Added</div>
        {AGE_FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`${styles.sidebarItem} ${ageFilter === opt.value ? styles.sidebarItemActive : ''}`}
            onClick={() => onAgeFilterChange(opt.value)}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>

      {/* Content filter */}
      <div className={styles.sidebarSection}>
        <div className={styles.sidebarSectionTitle}>Content</div>
        {CONTENT_FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`${styles.sidebarItem} ${contentFilter === opt.value ? styles.sidebarItemActive : ''}`}
            onClick={() => onContentFilterChange(opt.value)}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>

      {/* Folder scope filter */}
      <div className={styles.sidebarSection}>
        <div className={styles.sidebarSectionTitle}>Show</div>
        {FOLDER_FILTERS.map(opt => (
          <button
            key={opt.value}
            className={`${styles.sidebarItem} ${folderFilter === opt.value ? styles.sidebarItemActive : ''}`}
            onClick={() => onFolderFilterChange(opt.value)}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>

      {/* Stats */}
      {totalCount > 0 && (
        <div className={styles.sidebarSection}>
          <div className={styles.sidebarSectionTitle}>Info</div>
          <div className={styles.sidebarItem} style={{ cursor: 'default' }}>
            <span style={{ flex: 1 }}>Total</span>
            <span className={styles.sidebarItemCount}>{totalCount}</span>
          </div>
          {coldCount > 0 && (
            <div className={styles.sidebarItem} style={{ cursor: 'default' }}>
              <span style={{ flex: 1, color: 'var(--accent-red, #ff3b30)' }}>Stale (6mo+)</span>
              <span className={styles.sidebarItemCount}>{coldCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
