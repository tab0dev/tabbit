import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Copy, MagnifyingGlass, CaretDown } from '@phosphor-icons/react';
import styles from './TemplateSelect.module.css';
import { PRESET_TEMPLATES, REGION_TREE, getRegionMeta } from './templates';

// ─────────────────────────────────────────────
// Filter logic (from plan)
// ─────────────────────────────────────────────

interface TemplatePattern {
  value: string;
  [key: string]: unknown;
}

interface TemplateOption {
  id: string;
  category: string;
  region: string;
  title?: string;
  patterns: TemplatePattern[];
  [key: string]: unknown;
}

function getVisibleGroups(
  allTemplates: TemplateOption[],
  activeRegion: string | null,
  activeSubRegion: string | null,
) {
  const filterKey = activeSubRegion || activeRegion; // most specific wins

  const globals = allTemplates.filter((t) => t.region === 'global');

  if (!filterKey || filterKey === 'global') return buildDisplayList(globals, []);

  const regionals = allTemplates.filter(
    (t) => t.region !== 'global' && t.region.startsWith(filterKey),
  );

  return buildDisplayList(globals, regionals);
}

function buildDisplayList(globals: TemplateOption[], regionals: TemplateOption[]) {
  const map = new Map();
  globals.forEach((g) => map.set(g.category, { base: g, variants: [] }));
  regionals.forEach((r) => {
    const entry = map.get(r.category);
    if (entry) {
      entry.variants.push(r);
    } else {
      map.set(r.category, { base: null, variants: [r] });
    }
  });
  return map;
}

// ─────────────────────────────────────────────
// RegionSelect – styled sub-select (no native dropdown)
// ─────────────────────────────────────────────

function RegionSelect({
  value,
  onChange,
  options,
  title,
}: {
  value: string | null;
  onChange: (e: string | null) => void;
  options: { value: string | null; label: string }[];
  title: string;
}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const ref = useRef(null);

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !(ref.current as HTMLElement).contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePick = (val: string | null) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={styles.regionSelectContainer} ref={ref} title={title}>
      <button
        type="button"
        className={`${styles.regionSelectTrigger} ${isOpen ? styles.regionSelectOpen : ''}`}
        onClick={() => setIsOpen((p) => !p)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={styles.regionSelectLabel}>{selectedOption?.label}</span>
        <CaretDown size={10} weight="bold" className={styles.regionSelectCaret} />
      </button>

      {isOpen && (
        <div className={styles.regionSelectDropdown} role="listbox">
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`${styles.regionSelectOption} ${opt.value === value ? styles.regionSelectSelected : ''}`}
              onClick={() => handlePick(opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export interface TemplateSelectProps {
  onChange: (payload: { id?: string; type?: string; baseId?: string; variantId?: string }) => void;
  selectedId?: string | null;
  registerTarget: (name: string) => (el: HTMLElement | null) => void;
  className?: string;
}

export default function TemplateSelect({
  onChange,
  className = '',
  registerTarget,
}: TemplateSelectProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [activeRegion, setActiveRegion] = useState<string | null>(null); // null = All Regions
  const [activeSubRegion, setActiveSubRegion] = useState<string | null>(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !(containerRef.current as HTMLElement).contains(event.target as Node)
      ) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => (inputRef.current as HTMLInputElement | null)?.focus());
  }, [isOpen]);

  // The selected region node from REGION_TREE
  const selectedRegionNode = useMemo(
    () => (activeRegion ? REGION_TREE.find((r) => r.id === activeRegion) : null),
    [activeRegion],
  );

  const hasSubRegions = selectedRegionNode?.children
    ? selectedRegionNode.children.length > 0
    : false;

  // Visible groups for tree mode
  const visibleGroups = useMemo(
    () => getVisibleGroups(PRESET_TEMPLATES, activeRegion, activeSubRegion),
    [activeRegion, activeSubRegion],
  );

  // Filter visibleGroups by query, preserving tree structure.
  // A variant match surfaces it nested under its parent base.
  const filteredGroups = useMemo(() => {
    if (!query) return visibleGroups;

    const q = query.toLowerCase();
    const matchesQuery = (t: TemplateOption) => {
      const meta = getRegionMeta(t.region);
      return [
        t.groupName,
        t.category ?? '',
        meta.title,
        meta.label,
        ...t.patterns.map((p) => p.value),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    };

    const result = new Map();
    for (const [cat, { base, variants }] of visibleGroups.entries()) {
      const baseMatches = base && matchesQuery(base);
      const matchingVariants = variants.filter(matchesQuery);
      if (baseMatches || matchingVariants.length > 0) {
        result.set(cat, { base, variants: matchingVariants });
      }
    }
    return result;
  }, [visibleGroups, query]);

  const handleSelect = (id: string) => {
    onChange({ id });
    setIsOpen(false);
    setQuery('');
  };

  const handleAddMerged = (e: React.MouseEvent, baseId: string, variantId: string) => {
    e.stopPropagation();
    onChange({ type: 'merge', baseId, variantId });
    setIsOpen(false);
    setQuery('');
  };

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (isOpen) setQuery('');
  };

  const handleRegionChange = (val: string | null) => {
    setActiveRegion(val);
    setActiveSubRegion(null);
    setQuery('');
  };

  const handleSubRegionChange = (val: string | null) => {
    // If selecting "All [region]" option (which has value = region id), set to null
    setActiveSubRegion(val === activeRegion ? null : val);
  };

  return (
    <div className={`${styles.container} ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.open : ''}`}
        onClick={handleToggle}
        ref={registerTarget('ag-templates')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Copy size={14} weight="bold" className={styles.icon} />
        <span className={styles.selectedLabel}>Templates</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          {/* Header */}
          <div className={styles.dropdownHeader}>
            {/* Row 1: Search */}
            <div className={styles.searchRow}>
              <MagnifyingGlass size={14} weight="duotone" className={styles.searchIcon} />
              <input
                ref={inputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search templates…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    if (query) setQuery('');
                    else setIsOpen(false);
                  }
                }}
              />
            </div>

            {/* Row 2: Region + Sub-region selects */}
            <div className={styles.filterRow}>
              <RegionSelect
                value={activeRegion ?? ''}
                onChange={handleRegionChange}
                title="Filter by region"
                options={[
                  { value: '', label: '🌐 All Regions' },
                  ...REGION_TREE.filter((r) => r.id !== 'global').map((r) => ({
                    value: r.id,
                    label: `${r.label} ${r.title}`,
                  })),
                ]}
              />

              {hasSubRegions && (
                <RegionSelect
                  value={activeSubRegion ?? activeRegion}
                  onChange={handleSubRegionChange}
                  title="Filter by sub-region"
                  options={[
                    { value: activeRegion, label: `All ${selectedRegionNode?.title}` },
                    ...(selectedRegionNode?.children || []).map(
                      (c: { id: string; title: string; label: string }) => ({
                        value: c.id,
                        label: `${c.label} ${c.title}`,
                      }),
                    ),
                  ]}
                />
              )}
            </div>
          </div>

          {/* Options list */}
          <div className={styles.optionsList}>
            {[...filteredGroups.values()].length === 0 ? (
              <div className={styles.emptyState}>
                {query ? `No results for "${query}"` : 'No templates for this region'}
              </div>
            ) : (
              [...filteredGroups.values()].map(({ base, variants }) => {
                const formattedBase = base
                  ? base.patterns
                      .map((p: TemplatePattern) => {
                        const seg = p.value.replace(/^www\./, '').split('.')[0];
                        return seg.charAt(0).toUpperCase() + seg.slice(1);
                      })
                      .join(', ')
                  : '';

                return (
                  <div key={base?.id ?? variants[0]?.id} className={styles.treeGroup}>
                    {/* Parent row (global base) or standalone regional */}
                    {base ? (
                      <div
                        role="option"
                        aria-selected={false}
                        className={styles.option}
                        onClick={() => handleSelect(base.id)}
                      >
                        <div className={styles.optionHeader}>
                          {base.icon &&
                            (() => {
                              const Icon = base.icon as React.ElementType;
                              return <Icon size={16} weight="duotone" />;
                            })()}
                          <div className={styles.optionTitle}>{base.groupName}</div>
                        </div>
                        <div className={styles.optionSubtitle}>{formattedBase}</div>
                      </div>
                    ) : null}

                    {/* Variant child rows */}
                    {variants.map((v: TemplateOption) => {
                      const meta = getRegionMeta(v.region);
                      const vSub = v.patterns
                        .map((p) => {
                          const seg = p.value.replace(/^www\./, '').split('.')[0];
                          return seg.charAt(0).toUpperCase() + seg.slice(1);
                        })
                        .join(', ');

                      return (
                        <div
                          key={v.id}
                          role="option"
                          aria-selected={false}
                          className={`${styles.option} ${base ? styles.variantRow : ''}`}
                          onClick={(e) =>
                            base ? handleAddMerged(e, base.id, v.id) : handleSelect(v.id)
                          }
                        >
                          <div className={styles.optionHeader}>
                            {v.icon &&
                              (() => {
                                const Icon = v.icon as React.ElementType;
                                return <Icon size={16} weight="duotone" />;
                              })()}
                            <div className={styles.optionTitle}>
                              {v.groupName as React.ReactNode}
                            </div>
                            {base && (
                              <div className={styles.variantBtns}>
                                <button
                                  type="button"
                                  className={styles.mergeBtn}
                                  title={`${meta.label} only`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(v.id);
                                  }}
                                >
                                  Only region specific URLs
                                </button>
                              </div>
                            )}
                          </div>
                          <div className={styles.optionSubtitle}>{vSub}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
