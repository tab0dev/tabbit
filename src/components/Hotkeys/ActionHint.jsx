import { useState, useEffect, useRef } from 'react';
import { useHotkeys } from '../../store/HotkeysProvider';
import Tooltip from '../Shared/Tooltip';
import styles from './Hotkeys.module.css';

/**
 * A reusable hotkey hint component that displays the key and label,
 * and handles rebindable mouse interactions.
 */
export default function ActionHint({
    actionId,
    label,
    variant = 'button', // 'button' or 'text'
    secondary = false,
    active = false,   // when true, overrides secondary dimming (e.g. undo has items)
    disabled = false,
    onClick,
    showLabel = true,
    displayKey,
    rebindable = true
}) {
    const { hotkeys, updateHotkey } = useHotkeys();
    const [rebindActive, setRebindActive] = useState(false);
    const kbdRef = useRef(null);
    useEffect(() => {
        if (!rebindActive || !rebindable) return;

        const timer = setTimeout(() => setRebindActive(false), 15000);

        const handleKey = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;
            if (e.key === 'Escape') { setRebindActive(false); return; }

            const newKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
            updateHotkey(actionId, newKey);
            setRebindActive(false);
        };

        document.addEventListener('keydown', handleKey, true);
        document.body.classList.add('rebind-active-element');

        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', handleKey, true);
            document.body.classList.remove('rebind-active-element');
        };
    }, [rebindActive, actionId, updateHotkey, rebindable]);

    const handleMouseEnter = (e) => {
        if (disabled || !rebindable) return;
        setRebindActive(true);
    };

    const handleMouseLeave = () => {
        setRebindActive(false);
    };

    const handleKbdClick = (e) => {
        e.stopPropagation();
        // Clicking does nothing per user request
    };

    const resolvedDisplayKey = displayKey ?? hotkeys[actionId] ?? '';
    const formatKey = (k) => {
        if (!k) return '';
        const uk = k.toUpperCase();
        if (uk === 'ARROWUP') return '↑';
        if (uk === 'ARROWDOWN') return '↓';
        if (uk === 'ARROWLEFT') return '←';
        if (uk === 'ARROWRIGHT') return '→';
        if (uk === 'ENTER') return '↵';
        if (uk === 'ESCAPE') return 'Esc';
        return k;
    };

    if (variant === 'text') {
        return (
            <span className={styles.textHint}>
                <span className={styles.textHintKey}>{formatKey(resolvedDisplayKey)}</span>
                {showLabel && <span className={styles.textHintLabel}>{label}</span>}
            </span>
        );
    }

    return (
        <div
            className={`${styles.hint} ${secondary && !active ? styles.hintSecondary : ''} ${active ? styles.hintActive : ''} ${disabled ? styles.hintDisabled : ''}`}
            onClick={(e) => !disabled && onClick && onClick(e)}
            style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
            <kbd
                ref={kbdRef}
                className={rebindActive ? styles.rebindActive : ''}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleKbdClick}
            >
                {formatKey(resolvedDisplayKey)}
            </kbd>
            {showLabel && <span className={styles.hintLabel}>{label}</span>}

            <Tooltip visible={rebindActive} anchorRef={kbdRef}>
                Remapping now active, press a key to change the hotkey map.
            </Tooltip>
        </div>
    );
}
