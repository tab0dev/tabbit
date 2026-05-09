import React from "react";
import { Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import styles from "./RuleList.module.css";
import TemplateSelect from "./TemplateSelect";


export default function RuleList({ rules, onAdd, onAddTemplate, onEdit, onDelete, tabCountMap }) {
  return (
    <>
      {rules.map((rule, idx) => (
        <div key={rule.id}>
          {idx > 0 && <div className={styles.settingDivider} />}
          <div className={styles.ruleRow}>
            <div className={styles.ruleInfo}>
              <div className={styles.ruleHeader}>
                <span
                  className={styles.ruleColorBlob}
                  style={{ background: `var(--chrome-${rule.groupColor}, grey)` }}
                />
                <span className={styles.ruleName}>{rule.groupName}</span>
                {tabCountMap?.get(rule.groupName) > 0 && (
                  <span className={styles.ruleTabCount}>
                    · {tabCountMap.get(rule.groupName)} tab{tabCountMap.get(rule.groupName) !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className={styles.rulePatternTags}>
                {(
                  rule.patterns || [
                    { value: rule.pattern, isRegex: rule.isRegex },
                  ]
                ).map((p, i) => (
                  <span key={i} className={styles.patternTag}>
                    {p.isRegex && (
                      <span className={styles.regexBadge}>Re</span>
                    )}
                    {p.value}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.ruleActions}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => onEdit(rule)}
              >
                <PencilSimple size={16} />
              </button>
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                onClick={() => onDelete(rule.id)}
              >
                <Trash size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}

      {rules.length > 0 && <div className={styles.settingDivider} />}

      <div
        className={styles.settingRow}
        style={{ justifyContent: "center", padding: "12px", gap: "12px" }}
      >
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onAdd}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={14} weight="bold" />
          Add New Rule
        </button>
        <TemplateSelect
          onChange={(action) => {
            if (action) {
              onAddTemplate(action);
            }
          }}
        />
      </div>
    </>
  );
}
