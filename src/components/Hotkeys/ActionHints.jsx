import React from 'react';
import styles from './Hotkeys.module.css';
import { useTriage, Mode } from '../../store/TriageProvider';
import ActionHint from './ActionHint';

const ACTIONS = [
  { id: 'keep', label: 'Keep', triageOnly: true },
  { id: 'close', label: 'Close', triageOnly: true },
  { id: 'bookmark', label: 'Bookmark', triageOnly: true },
  { id: 'group', label: 'Group', triageOnly: true },
  // { id: 'back', label: 'Back', secondary: true, triageOnly: true },
];

export default function ActionHints({ actions, embedded = false }) {
  const { state } = useTriage();

  const handleClick = (actionId) => {
    if (state.mode !== Mode.TRIAGING && actionId !== 'undo') return;
    const currentTab = state.tabs[state.currentIndex];

    switch (actionId) {
      case 'keep': if (currentTab) actions.keep(currentTab); break;
      case 'close': if (currentTab) actions.close(currentTab); break;
      case 'bookmark': document.getElementById('picker-search-bookmark')?.focus(); break;
      case 'group': document.getElementById('picker-search-group')?.focus(); break;
      // case 'back': actions.back(); break;
      case 'undo': actions.undo(); break;
    }
  };

  const renderAction = (actionId) => {
    const action = ACTIONS.find(a => a.id === actionId);
    if (!action) return null;
    const isUndo = action.id === 'undo';
    const hasUndoItems = state.undoStack.length > 0;
    return (
      <ActionHint
        key={action.id}
        actionId={action.id}
        label={action.label}
        secondary={action.secondary}
        active={isUndo && hasUndoItems}
        disabled={action.triageOnly && state.mode !== Mode.TRIAGING}
        onClick={() => handleClick(action.id)}
      />
    );
  };

  return (
    <div className={styles.containerWrapper}>
      <div className={`${styles.hotkeysCard} ${embedded ? styles.embedded : ''}`}>
        <div className={styles.gridLeft}>
          {renderAction('close')}
        </div>
        <div className={styles.gridCenter}>
          {renderAction('group')}
          {renderAction('bookmark')}
        </div>
        <div className={styles.gridRight}>
          {renderAction('keep')}
        </div>
      </div>
    </div>
  );
}
