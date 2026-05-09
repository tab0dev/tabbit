import React, { useRef, useState } from "react";
import { Plus, Trash, Check, X, ArrowCounterClockwise, Warning } from "@phosphor-icons/react";
import Select from "../../Shared/Select";
import InfoIconWithTooltip from "../../Shared/InfoIconWithTooltip";
import Tooltip from "../../Shared/Tooltip";
import styles from "./RuleEditForm.module.css";
import { GROUP_COLORS } from "./constants";
import { generateMatcherRegex } from "../../../utils/matcherRegex";

export default function RuleEditForm({
  editForm,
  setEditForm,
  onSave,
  onCancel,
  patternConflictMap = new Map(),
  onEditConflictRule,
}) {
  const isValidSimpleDomain = (str) => {
    if (!str) return false;
    let cleaned = str.trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./i, '');
    return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleaned);
  };

  const isValidRegex = (str) => {
    if (!str) return false;
    return generateMatcherRegex(str, true, 'regex') !== null;
  };

  const isValidPattern = (str) => {
    if (!str) return false;
    // Strict Chrome Match Pattern format: <scheme>://<host><path>
    const matchPatternRegex = /^(?:(?:https?|ftp|urn|\*):\/\/(?:\*|(?:\*\.)?[^/*]+)\/.*|file:\/\/(?:\*|(?:\*\.)?[^/*]+)?\/.*)$/;
    return matchPatternRegex.test(str);
  };

  const isValidRough = (str) => {
    return str && str.trim().length > 0;
  };

  const ValidationIcon = ({ pattern, conflict }) => {
    const anchorRef = useRef(null);
    const [tooltipVisible, setTooltipVisible] = useState(false);

    // ── Conflict state (takes priority over valid ✅) ──
    if (conflict) {
      const { rule, tabs } = conflict;
      const tabWord = tabs.length === 1 ? 'tab' : 'tabs';
      // Up to 3 example tab titles for the tooltip body
      const examples = tabs.slice(0, 3).map(t => t.title || t.url || 'Untitled');
      const more = tabs.length > 3 ? tabs.length - 3 : 0;

      return (
        <>
          <span
            ref={anchorRef}
            className={`${styles.validationIcon} ${styles.validationIconConflict}`}
            role="button"
            tabIndex={0}
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
            onFocus={() => setTooltipVisible(true)}
            onBlur={() => setTooltipVisible(false)}
            onClick={() => onEditConflictRule?.(rule)}
            onKeyDown={e => e.key === 'Enter' && onEditConflictRule?.(rule)}
            aria-label={`Conflict with rule "${rule.groupName}". Click to edit it.`}
          >
            <Warning color="var(--warning-color, #f59e0b)" weight="fill" size={15} />
          </span>
          <Tooltip anchorRef={anchorRef} visible={tooltipVisible} placement="top" offset={10}>
            <div className={styles.conflictTooltip}>
              <div className={styles.conflictTooltipHeader}>
                <Warning color="var(--warning-color, #f59e0b)" weight="fill" size={13} />
                <span>Conflict with <strong>&ldquo;{rule.groupName}&rdquo;</strong></span>
              </div>
              <p className={styles.conflictTooltipBody}>
                {tabs.length} {tabWord} already grouped here:
              </p>
              <ul className={styles.conflictTooltipList}>
                {examples.map((title, i) => (
                  <li key={i} className={styles.conflictTooltipItem}>{title}</li>
                ))}
                {more > 0 && (
                  <li className={styles.conflictTooltipMore}>+{more} more…</li>
                )}
              </ul>
              <p className={styles.conflictTooltipHint}>Click to edit that rule first.</p>
            </div>
          </Tooltip>
        </>
      );
    }

    // ── Standard valid / invalid state ──
    const type = pattern.type || (pattern.isRegex ? 'regex' : 'pattern');
    const val = pattern.value;

    if (!val && type !== 'rough') return null;

    let isValid = false;
    let validMsg = "";
    let invalidMsg = "";

    switch (type) {
      //works
      case 'simple':
        isValid = isValidSimpleDomain(val);
        validMsg = "Valid domain";
        invalidMsg = "Invalid domain format (e.g. example.com)";
        break;
      // broken
      case 'regex':
        isValid = isValidRegex(val);
        validMsg = "Valid regex";
        invalidMsg = "Invalid regular expression";
        break;
      // broken
      case 'pattern':
        isValid = isValidPattern(val);
        validMsg = "Valid pattern";
        invalidMsg = "Invalid URL match pattern";
        break;
      // works
      case 'rough':
        isValid = isValidRough(val);
        validMsg = "Valid text";
        invalidMsg = "Text cannot be empty";
        break;
      default:
        return null;
    }

    return (
      <span className={styles.validationIcon} title={isValid ? validMsg : invalidMsg}>
        {isValid ? <Check color="var(--success-color, #10b981)" weight="bold" /> : <X color="var(--danger-color, #ef4444)" weight="bold" />}
      </span>
    );
  };

  const TYPE_OPTIONS = [
    { value: 'simple', label: 'Simple Domain' },
    { value: 'pattern', label: 'URL Pattern' },
    { value: 'rough', label: 'Rough Match' },
    { value: 'regex', label: 'Regex' }
  ];

  const TARGET_OPTIONS = [
    { value: 'hostname', label: 'Hostname' },
    { value: 'href', label: 'Full URL' },
    { value: 'title', label: 'Page Title' },
    { value: 'title_ignorecase', label: 'Page Title (ignore case)' }
  ];

  const METHOD_OPTIONS = [
    { value: 'includes', label: 'Includes' },
    { value: 'startsWith', label: 'Starts with' },
    { value: 'endsWith', label: 'Ends with' },
    { value: 'equals', label: 'Equals' }
  ];

  return (
    <div className={styles.addForm}>
      <div className={styles.formRowHorizontal} style={{ alignItems: "flex-start", marginBottom: 4 }}>
        <div className={styles.formRow} style={{ flex: 1 }}>
          <span className={styles.formLabel}>Group Name</span>
          <input
            type="text"
            className={styles.textInput}
            value={editForm.groupName}
            onChange={(e) =>
              setEditForm({ ...editForm, groupName: e.target.value })
            }
            placeholder="e.g. Social Media"
          />
        </div>
        <div className={styles.formRow} style={{ width: 244 }}>
          <span className={styles.formLabel}>Color</span>
          <div className={styles.colorPickerContainer}>
            {GROUP_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`${styles.colorSwatch} ${editForm.groupColor === c.value
                  ? styles.colorSwatchSelected
                  : ""
                  }`}
                style={{ backgroundColor: `var(--chrome-${c.value})` }}
                onClick={() =>
                  setEditForm({ ...editForm, groupColor: c.value })
                }
                title={c.label}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.formRow} style={{ marginBottom: 16 }}>
        <span className={styles.formLabel}>Options</span>
        <div className={styles.modeCardsContainer}>
          <div className={styles.modeCard}>
            <span className={styles.modeCardTitle}>
              Strict Mode
              <InfoIconWithTooltip placement="right">Remove tabs from this group if the URL stops matching</InfoIconWithTooltip>
            </span>
            <label className={styles.enableToggle}>
              <input
                type="checkbox"
                checked={editForm.strict}
                onChange={(e) =>
                  setEditForm({ ...editForm, strict: e.target.checked })
                }
                className={styles.toggleInput}
              />
              <span
                className={`${styles.toggleTrack} ${editForm.strict ? styles.toggleTrackOn : ""}`}
              >
                <span className={styles.toggleThumb} />
              </span>
            </label>
          </div>
          <div className={styles.modeCard}>
            <span className={styles.modeCardTitle}>
              Merge Mode
              <InfoIconWithTooltip placement="right">Allow tabs to be moved into groups in other windows</InfoIconWithTooltip>
            </span>
            <label className={styles.enableToggle}>
              <input
                type="checkbox"
                checked={editForm.merge}
                onChange={(e) =>
                  setEditForm({ ...editForm, merge: e.target.checked })
                }
                className={styles.toggleInput}
              />
              <span
                className={`${styles.toggleTrack} ${editForm.merge ? styles.toggleTrackOn : ""}`}
              >
                <span className={styles.toggleThumb} />
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className={styles.formRow} style={{ marginBottom: 12 }}>
        <span className={styles.formLabel}>URL Patterns</span>
        <div className={styles.patternList}>
          {editForm.patterns.map((pattern, idx) => (
            <div key={pattern.id} className={styles.patternRow}>
              <div className={styles.patternInputWrapper}>
                {(pattern.type === 'rough') ? (
                  <div className={styles.roughInputWrapper}>
                    <Select
                      className={styles.roughSelect}
                      value={pattern.target || 'hostname'}
                      onChange={(e) => {
                        const newPatterns = [...editForm.patterns];
                        newPatterns[idx].target = e.target.value;
                        setEditForm({ ...editForm, patterns: newPatterns });
                      }}
                      options={TARGET_OPTIONS}
                    />
                    <Select
                      className={styles.roughSelect}
                      value={pattern.method || 'includes'}
                      onChange={(e) => {
                        const newPatterns = [...editForm.patterns];
                        newPatterns[idx].method = e.target.value;
                        setEditForm({ ...editForm, patterns: newPatterns });
                      }}
                      options={METHOD_OPTIONS}
                    />
                    <input
                      type="text"
                      className={styles.patternInput}
                      value={pattern.value}
                      onChange={(e) => {
                        const newPatterns = [...editForm.patterns];
                        newPatterns[idx].value = e.target.value;
                        setEditForm({ ...editForm, patterns: newPatterns });
                      }}
                      placeholder="Match text..."
                    />
                    <ValidationIcon pattern={pattern} conflict={undefined} />
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      className={styles.patternInput}
                      value={pattern.value}
                      onChange={(e) => {
                        const newPatterns = [...editForm.patterns];
                        newPatterns[idx].value = e.target.value;
                        setEditForm({ ...editForm, patterns: newPatterns });
                      }}
                      placeholder={
                        (pattern.type || (pattern.isRegex ? 'regex' : 'pattern')) === 'regex'
                          ? "^https?://example\\.com/.*"
                          : (pattern.type || (pattern.isRegex ? 'regex' : 'pattern')) === 'simple'
                            ? "example.com"
                            : "*://*.example.com/*"
                      }
                    />
                    <ValidationIcon pattern={pattern} conflict={patternConflictMap.get(pattern.id)} />
                  </>
                )}
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => {
                    const newPatterns = [...editForm.patterns];
                    const pType = newPatterns[idx].type || (newPatterns[idx].isRegex ? 'regex' : 'pattern');
                    if (pType === 'pattern') newPatterns[idx].value = '*://*.example.com/*';
                    else if (pType === 'regex') newPatterns[idx].value = '^https?://example\\.com/.*';
                    else newPatterns[idx].value = '';
                    setEditForm({ ...editForm, patterns: newPatterns });
                  }}
                  title="Reset to default"
                  style={{ marginRight: 6 }}
                >
                  <ArrowCounterClockwise size={16} />
                </button>
              </div>
              <div className={styles.patternActions}>
                <Select
                  className={styles.patternSelect}
                  value={pattern.type || (pattern.isRegex ? 'regex' : 'pattern')}
                  onChange={(e) => {
                    const newPatterns = [...editForm.patterns];
                    const newType = e.target.value;
                    const oldVal = newPatterns[idx].value;
                    const isDefault = !oldVal || ['*://*.github.com/*', '^https?://github\\.com/.*', '*://*.example.com/*', '^https?://example\\.com/.*'].includes(oldVal);

                    newPatterns[idx].type = newType;
                    newPatterns[idx].isRegex = newType === 'regex';
                    if (newType === 'rough') {
                      if (!newPatterns[idx].target) newPatterns[idx].target = 'hostname';
                      if (!newPatterns[idx].method) newPatterns[idx].method = 'includes';
                      if (isDefault) newPatterns[idx].value = '';
                    } else if (newType === 'pattern' && isDefault) {
                      newPatterns[idx].value = '*://*.example.com/*';
                    } else if (newType === 'regex' && isDefault) {
                      newPatterns[idx].value = '^https?://example\\.com/.*';
                    } else if (newType === 'simple' && isDefault) {
                      newPatterns[idx].value = '';
                    }
                    setEditForm({ ...editForm, patterns: newPatterns });
                  }}
                  options={TYPE_OPTIONS}
                />
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                  onClick={() => {
                    const newPatterns = editForm.patterns.filter(
                      (_, i) => i !== idx
                    );
                    setEditForm({ ...editForm, patterns: newPatterns });
                  }}
                  title="Remove pattern"
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => {
            setEditForm({
              ...editForm,
              patterns: [
                ...editForm.patterns,
                { id: Date.now().toString(), value: "", type: "simple", isRegex: false },
              ],
            });
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            alignSelf: "flex-start",
            padding: "6px 10px",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          <Plus size={12} weight="bold" /> Add Pattern
        </button>
      </div>

      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button type="button" className={styles.btnPrimary} onClick={onSave} disabled={patternConflictMap.size > 0} title={patternConflictMap.size > 0 ? "Resolve all pattern conflicts before saving" : undefined}>
          Done
        </button>
      </div>
    </div>
  );
}
