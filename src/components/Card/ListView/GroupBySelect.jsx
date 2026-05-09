import React, { useState, useRef, useEffect } from 'react';
import { GridFour, CaretDown } from '@phosphor-icons/react';
import styles from './ListView.module.css';

/**
 * GroupBySelect — a compact icon+label trigger that opens a shared-Select–style
 * dropdown. Lives next to the grid/list view toggle so it reads as a sibling control.
 */
export default function GroupBySelect({ value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    function onOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  const handleSelect = (val) => {
    onChange({ target: { value: val } });
    setIsOpen(false);
  };

  return (
    <div className={`${styles.groupByContainer} ${isOpen ? styles.groupByOpen : ''}`} ref={containerRef}>
      <button
        type="button"
        className={`${styles.groupByTrigger} ${isOpen ? styles.groupByTriggerOpen : ''}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Group by…"
      >
        <GridFour size={14} weight="duotone" />
        <span className={styles.groupByLabel}>{selected?.shortLabel ?? selected?.label}</span>
        <CaretDown size={11} weight="bold" className={`${styles.groupByCaret} ${isOpen ? styles.groupByCaretOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.groupByDropdown} role="listbox">
          <div className={styles.groupByDropdownHeader}>Group by</div>
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`${styles.groupByOption} ${opt.value === value ? styles.groupByOptionSelected : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
