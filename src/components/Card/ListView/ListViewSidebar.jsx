import React from 'react';
import styles from './ListView.module.css';
import { extractDomain } from '../../../utils/formatters';
import { GROUP_COLORS } from '../../Overlay/TabGroupPickerPanel';

// Sidebar filter panel for the List View.
// Renders filter sections: Sort, Tab Groups, Domains.

export default function ListViewSidebar({
  tabs,
  tabGroups,
  sortMode,
  onSortChange,
  filterGroupIds,
  onToggleGroupFilter,
  filterDomains,
  onToggleDomainFilter,
}) {
  // ── Derive domain stats from eligible tabs ────────────────────────────────
  const domainCounts = React.useMemo(() => {
    const map = new Map();
    tabs.forEach(t => {
      const d = extractDomain(t.url);
      map.set(d, (map.get(d) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])  // most tabs first
      .slice(0, 20); // cap at 20 to keep sidebar manageable
  }, [tabs]);

  // ── Derive tab group stats ────────────────────────────────────────────────
  const groupCounts = React.useMemo(() => {
    const map = new Map();
    tabs.forEach(t => {
      const gid = t.groupId ?? -1;
      map.set(gid, (map.get(gid) || 0) + 1);
    });
    const entries = [];
    // "Ungrouped" first
    if (map.has(-1)) entries.push({ id: -1, title: 'Ungrouped', color: null, count: map.get(-1) });
    tabGroups.forEach(g => {
      if (map.has(g.id)) entries.push({ id: g.id, title: g.title || 'Untitled', color: GROUP_COLORS[g.color] ?? GROUP_COLORS.grey, count: map.get(g.id) });
    });
    return entries;
  }, [tabs, tabGroups]);

  const sortOptions = [
    { value: 'auto', label: 'Default' },
    { value: 'alphabetical', label: 'A → Z' },
    { value: 'oldest_first', label: 'Oldest' },
    { value: 'newest_first', label: 'Newest' },
    { value: 'group_by_site', label: 'By Site' },
  ];

  return (
    <div className={styles.sidebar}>
      {/* Sort */}
      <div className={styles.sidebarSection}>
        <div className={styles.sidebarSectionTitle}>Sort</div>
        {sortOptions.map(opt => (
          <button
            key={opt.value}
            className={`${styles.sidebarItem} ${sortMode === opt.value ? styles.sidebarItemActive : ''}`}
            onClick={() => onSortChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tab Groups */}
      {groupCounts.length > 0 && (
        <div className={styles.sidebarSection}>
          <div className={styles.sidebarSectionTitle}>Tab Groups</div>
          {groupCounts.map(g => {
            const isActive = filterGroupIds.has(g.id);
            return (
              <button
                key={g.id}
                className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                onClick={() => onToggleGroupFilter(g.id)}
              >
                {g.color && <span className={styles.sidebarColorDot} style={{ background: g.color }} />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
                <span className={styles.sidebarItemCount}>{g.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Domains */}
      {domainCounts.length > 1 && (
        <div className={styles.sidebarSection}>
          <div className={styles.sidebarSectionTitle}>Domains</div>
          {domainCounts.map(([domain, count]) => {
            const isActive = filterDomains.has(domain);
            return (
              <button
                key={domain}
                className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
                onClick={() => onToggleDomainFilter(domain)}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{domain}</span>
                <span className={styles.sidebarItemCount}>{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
