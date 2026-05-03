import React, { useState, useRef, useCallback } from 'react';
import styles from '../AutoTabGroupWizard.module.css';

// editable group name input shown at the top of the right pane.
// commits on blur or enter, reverts on escape.
export default function GroupNameInput({ name, onCommit, registerTarget }) {
    const [draft, setDraft] = useState(name);
    const inputRef = useRef(null);

    const commit = () => {
        const trimmed = draft.trim();
        if (trimmed) onCommit(trimmed);
        else setDraft(name);
    };

    // merge our local ref with the optional tutorial registration ref
    const setRef = useCallback((node) => {
        inputRef.current = node;
        if (registerTarget) registerTarget(node);
    }, [registerTarget]);

    return (
        <input
            ref={setRef}
            className={styles.groupNameInput}
            value={draft}
            placeholder="Group name…"
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); inputRef.current?.blur(); }
                if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); setDraft(name); inputRef.current?.blur(); }
                e.stopPropagation();
            }}
            onPointerDown={e => e.stopPropagation()}
        />
    );
}
