import React, { useState, useRef, useEffect } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  options: SelectOption[];
  className?: string;
  direction?: 'up' | 'down';
  variant?: 'default' | 'minimal';
  disabled?: boolean;
}

export default function Select({
  value,
  onChange,
  options,
  className = '',
  direction = 'down',
  variant = 'default',
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (val: string) => {
    // Mimic the synthetic event parameter format: { target: { value: val } }
    onChange({ target: { value: val } });
    setIsOpen(false);
  };

  return (
    <div className={`${styles.container} ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.open : ''} ${variant === 'minimal' ? styles.minimal : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span className={styles.selectedLabel}>{selectedOption?.label}</span>
        <CaretDown size={14} weight="bold" className={styles.icon} />
      </button>

      {isOpen && (
        <div
          className={`${styles.dropdown} ${direction === 'up' ? styles.up : styles.down}`}
          role="listbox"
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`${styles.option} ${opt.value === value ? styles.selected : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(opt.value);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
