import React, { useState, useRef, useCallback } from 'react';
import styles from './ManualTabGroupWizard.module.css';

// editable group name input shown at the top of the right pane.
// commits on blur or enter, reverts on escape.
export interface GroupNameInputProps {
  name: string;
  onCommit: (name: string) => void;
  registerTarget?: (el: HTMLElement | null) => void;
}

export default function GroupNameInput({ name, onCommit, registerTarget }: GroupNameInputProps) {
  const [draft, setDraft] = useState<string>(name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onCommit(trimmed);
    else setDraft(name);
  };

  // merge our local ref with the optional tutorial registration ref
  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (registerTarget) registerTarget(node);
    },
    [registerTarget],
  );

  return (
    <input
      ref={setRef}
      className={styles.groupNameInput}
      value={draft}
      placeholder="Group name…"
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          inputRef.current?.blur();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.nativeEvent.stopImmediatePropagation();
          setDraft(name);
          inputRef.current?.blur();
        }
        e.stopPropagation();
      }}
      onPointerDown={(e: React.PointerEvent<HTMLInputElement>) => e.stopPropagation()}
    />
  );
}
