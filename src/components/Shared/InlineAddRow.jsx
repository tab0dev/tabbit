import React, { useRef, useEffect } from 'react';
import styles from '../Overlay/Overlay.module.css';

// shared inline input row for creating new items (folders, groups, etc.)
// auto-focuses on mount, submits on enter, cancels on escape.
export default function InlineAddRow({
  name,
  onChange,
  onCreate,
  onCancel,
  placeholder = 'Name…',
  icon = null,
  style = {},
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    // small delay lets the row render before stealing focus
    setTimeout(() => inputRef.current?.focus(), 40);
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onCreate(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
  };

  return (
    <li className={styles.inlineAddRow} style={style}>
      {icon}
      <input
        ref={inputRef}
        className={styles.inlineAddInput}
        placeholder={placeholder}
        value={name}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        data-inline-add="true"
      />
      <button className={styles.inlineAddCreateBtn} onClick={onCreate}>
        Create
      </button>
      <button className={styles.inlineAddCancelBtn} onClick={onCancel} title="Cancel (Esc)">
        ✕
      </button>
    </li>
  );
}
