import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Magnet,
} from "@phosphor-icons/react";
import styles from "./AutoTabGrouperWorkerPanel.module.css";
import { useTriage } from "../../../store/TriageProvider";
import { useTabProcessing } from "../../../store/TabProcessingProvider";
import { useAutoGrouper } from "../../../hooks/useAutoGrouper";
import { useTriageActions } from "../../../hooks/useTriageActions";
import { generateMatcherRegex, evaluateRoughMatch } from "../../../utils/matcherRegex";
import InfoIconWithTooltip from '../../Shared/InfoIconWithTooltip';

import RuleEditForm from "./RuleEditForm";
import RuleList from "./RuleList";
import PreviewGrid from "./PreviewGrid";
import ApplyTabsModal from "./ApplyTabsModal";
import { PRESET_TEMPLATES } from "./templates";

export default function AutoTabGrouperWorkerPanel({ onClose }) {
  const { state, dispatch } = useTriage();
  const { excludeSuspendedTabs } = useTabProcessing();
  const { group: groupAction } = useTriageActions();
  const {
    settings,
    updateSettings,
    rules,
    updateRules,
    loading,
  } = useAutoGrouper();

  const [enabled, setEnabled] = useState(settings.enabled);
  const [localRules, setLocalRules] = useState([]);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [pendingApplyTabs, setPendingApplyTabs] = useState([]);

  useEffect(() => {
    if (!loading) {
      setEnabled(settings.enabled);
      setLocalRules([...rules]);
    }
  }, [loading, settings.enabled, rules]);

  // Check if anything is unsaved
  const hasSettingsChanges = enabled !== settings.enabled;
  const hasRulesChanges = JSON.stringify(localRules) !== JSON.stringify(rules);
  const hasChanges = hasSettingsChanges || hasRulesChanges;

  // Maps each rule groupName → current tab count in the matching Chrome tab group.
  // Used to display live group occupancy next to each rule in the list.
  const groupTabCountMap = useMemo(() => {
    const map = new Map();
    state.tabs.forEach(tab => {
      const gid = tab.groupId ?? -1;
      if (gid === -1 || tab.gone) return;
      state.tabGroups.forEach(g => {
        if (g.id === gid) {
          map.set(g.title, (map.get(g.title) ?? 0) + 1);
        }
      });
    });
    return map;
  }, [state.tabs, state.tabGroups]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingRuleId) return;
    await updateSettings({ enabled });
    await updateRules(localRules);

    // previewTabs already excludes tabs that are in their target group,
    // so we just need to check enabled + non-empty.
    if (enabled && previewTabs.length > 0) {
      setPendingApplyTabs(previewTabs);
      setShowApplyModal(true);
      return;
    }

    onClose();
  };



  // The preview matches tabs against the currently edited rule (if editing),
  // OR against all local rules (if not editing).
  // Tabs already sitting in their target group are excluded from both paths.
  const previewTabs = useMemo(() => {
    if (!state.tabs) return [];

    // Respect the global "Exclude Suspended Tabs" setting — isSuspended is
    // already stamped on each tab by triageLoader.js, so no new plumbing needed.
    const visibleTabs = excludeSuspendedTabs
      ? state.tabs.filter(tab => !tab.isSuspended)
      : state.tabs;

    // A tab is already correctly grouped if a Chrome tab group exists with
    // the same title as the rule's groupName AND the tab is in that group.
    const isAlreadyGrouped = (tab, ruleName) => {
      const targetGroup = state.tabGroups.find(g => g.title === ruleName);
      return !!(targetGroup && tab.groupId === targetGroup.id);
    };

    if (editingRuleId && editForm) {
      const patterns = editForm.patterns || [];
      const regexPatterns = patterns.filter(p => p.type !== 'rough');
      const roughPatterns = patterns.filter(p => p.type === 'rough');
      const compiledRegexes = regexPatterns.map(p => generateMatcherRegex(p.value, p.isRegex, p.type)).filter(Boolean);

      return visibleTabs
        .filter(tab => {
          let isMatch = compiledRegexes.some(r => r.test(tab.url));
          if (!isMatch && roughPatterns.length > 0) {
            isMatch = roughPatterns.some(rough => evaluateRoughMatch(rough, tab));
          }
          return isMatch && !isAlreadyGrouped(tab, editForm.groupName);
        })
        .map(tab => ({ ...tab, matchedRule: editForm }));
    }

    // Match against all rules
    const matched = [];
    for (const tab of visibleTabs) {
      if (!tab.url) continue;
      for (const rule of localRules) {
        const patterns = rule.patterns || [{ value: rule.pattern, isRegex: rule.isRegex, type: rule.type }];
        const regexPatterns = patterns.filter(p => p.type !== 'rough');
        const roughPatterns = patterns.filter(p => p.type === 'rough');
        const compiledRegexes = regexPatterns.map(p => generateMatcherRegex(p.value, p.isRegex, p.type)).filter(Boolean);

        let isMatch = compiledRegexes.some(r => r.test(tab.url));
        if (!isMatch && roughPatterns.length > 0) {
          isMatch = roughPatterns.some(rough => evaluateRoughMatch(rough, tab));
        }

        if (isMatch && !isAlreadyGrouped(tab, rule.groupName)) {
          matched.push({ ...tab, matchedRule: rule });
          break;
        }
      }
    }
    return matched;
  }, [state.tabs, state.tabGroups, editingRuleId, editForm, localRules, excludeSuspendedTabs]);

  // Detects conflicts between the patterns in the form being edited and tabs
  // already physically sitting inside a Chrome tab group owned by a different rule.
  // Map<patternId, { rule: conflictingRule, tabs: conflictingTabs[] }>
  const patternConflictMap = useMemo(() => {
    if (!editingRuleId || !editForm || !enabled) return new Map();
    const result = new Map();

    for (const pattern of (editForm.patterns ?? [])) {
      if (pattern.type === 'rough') continue; // rough match excluded from conflict detection
      const regex = generateMatcherRegex(pattern.value, pattern.isRegex, pattern.type);
      if (!regex) continue; // invalid syntax — ValidationIcon already shows ❌

      for (const rule of localRules) {
        if (rule.id === editingRuleId) continue; // don't self-conflict
        const targetGroup = state.tabGroups.find(g => g.title === rule.groupName);
        if (!targetGroup) continue; // rule has no live Chrome group yet

        const conflictingTabs = state.tabs.filter(
          tab => tab.groupId === targetGroup.id && !tab.gone && tab.url && regex.test(tab.url)
        );

        if (conflictingTabs.length > 0) {
          result.set(pattern.id, { rule, tabs: conflictingTabs });
          break; // first conflicting rule wins
        }
      }
    }
    return result;
  }, [editingRuleId, editForm, localRules, state.tabs, state.tabGroups, enabled]);

  // Called when user confirms "Move Tabs Now" in ApplyTabsModal.
  // Uses the exact same groupAction path as TabGroupPickerPanel batch mode:
  //   groupAction → chrome.tabs.group + globalChromeUndoStack push + PROCESS_TAB dispatch.
  // New groups are created via the createTabGroup pattern in TabGroupPickerPanel.
  const handleApplyConfirm = useCallback(async () => {
    const byRule = new Map();
    for (const tab of pendingApplyTabs) {
      const ruleId = tab.matchedRule.id;
      if (!byRule.has(ruleId)) byRule.set(ruleId, { rule: tab.matchedRule, tabs: [] });
      byRule.get(ruleId).tabs.push(tab);
    }

    for (const { rule, tabs } of byRule.values()) {
      // Check for an existing Chrome tab group with matching name
      const existing = state.tabGroups.find(g => g.title === rule.groupName);

      if (existing) {
        // ── Path A: merge into existing group (mirrors TabGroupPickerPanel onConfirmItem batch) ──
        tabs.forEach(tab => groupAction(tab, existing.id, true));
      } else {
        // ── Path B: create new group (mirrors TabGroupPickerPanel.createTabGroup) ──
        try {
          const tabIds = tabs.map(t => t.id);
          const groupId = await chrome.tabs.group({ tabIds });
          await chrome.tabGroups.update(groupId, { title: rule.groupName, color: rule.groupColor });
          const newGroup = {
            id: groupId,
            title: rule.groupName,
            color: rule.groupColor,
            windowId: tabs[0].windowId,
          };
          dispatch({ type: 'ADD_TAB_GROUP', payload: newGroup });
          // groupAction per tab: pushes to globalChromeUndoStack + dispatches PROCESS_TAB
          // chrome.tabs.group call inside groupAction is a no-op for tabs already in the group
          tabs.forEach(tab => groupAction(tab, groupId, true));
        } catch (err) {
          console.warn('[Tabbit] ApplyTabsModal: failed to create tab group:', err);
        }
      }
    }

    onClose();
  }, [pendingApplyTabs, state.tabGroups, groupAction, dispatch, onClose]);

  const handleApplySkip = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleAddRule = () => {
    const newRule = {
      id: Date.now().toString(),
      patterns: [{ id: Date.now().toString(), value: "", type: "simple", isRegex: false }],
      groupName: "New Group",
      groupColor: "grey",
      strict: true,
      merge: false,
    };
    setEditForm(newRule);
    setEditingRuleId(newRule.id);
  };

  const handleAddTemplate = (action) => {
    if (action && action.type === 'merge') {
      const base = PRESET_TEMPLATES.find(t => t.id === action.baseId);
      const variant = PRESET_TEMPLATES.find(t => t.id === action.variantId);
      if (!base || !variant) return;
      const mergedPatterns = [...base.patterns, ...variant.patterns];
      const newRule = {
        id: Date.now().toString(),
        groupName: base.groupName,
        groupColor: base.groupColor,
        strict: base.strict,
        merge: base.merge,
        patterns: mergedPatterns.map((p, idx) => ({ ...p, id: `${Date.now()}-${idx}` })),
      };
      setEditForm(newRule);
      setEditingRuleId(newRule.id);
      return;
    }
    // Plain id (single template)
    const templateId = action && action.id ? action.id : action;
    const template = PRESET_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    const newRule = {
      id: Date.now().toString(),
      groupName: template.groupName,
      groupColor: template.groupColor,
      strict: template.strict,
      merge: template.merge,
      patterns: template.patterns.map((p, idx) => ({ ...p, id: `${Date.now()}-${idx}` })),
    };
    setEditForm(newRule);
    setEditingRuleId(newRule.id);
  };

  const handleEditRule = (rule) => {
    const patterns = rule.patterns || [{ id: Date.now().toString(), value: rule.pattern || "", isRegex: rule.isRegex || false }];
    setEditForm({ ...rule, patterns });
    setEditingRuleId(rule.id);
  };

  const handleDeleteRule = (id) => {
    setLocalRules(localRules.filter(r => r.id !== id));
  };

  const handleSaveForm = () => {
    if (!editForm.patterns || editForm.patterns.length === 0 || !editForm.groupName) return;
    const cleanedPatterns = editForm.patterns.filter(p => p.value.trim() !== "");
    if (cleanedPatterns.length === 0) return;

    const ruleToSave = { ...editForm, patterns: cleanedPatterns };

    const exists = localRules.some(r => r.id === ruleToSave.id);
    if (exists) {
      setLocalRules(localRules.map(r => r.id === ruleToSave.id ? ruleToSave : r));
    } else {
      setLocalRules([...localRules, ruleToSave]);
    }
    setEditingRuleId(null);
    setEditForm(null);
  };

  const handleCancelForm = () => {
    setEditingRuleId(null);
    setEditForm(null);
  };

  return (
    <>
    {showApplyModal && (
      <ApplyTabsModal
        previewTabs={pendingApplyTabs}
        onConfirm={handleApplyConfirm}
        onSkip={handleApplySkip}
      />
    )}
    <form className={styles.autoGrouperWorkerCard} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Magnet size={16} weight="duotone" />
          Auto Tab Grouper
          <InfoIconWithTooltip placement="right">Runs in the background and automatically puts new tabs into groups based on custom URL match patterns or regex.</InfoIconWithTooltip>
        </span>
        <label
          className={styles.enableToggle}
          title={enabled ? "Disable auto-grouper" : "Enable auto-grouper"}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className={styles.toggleInput}
          />
          <span className={styles.toggleLabel}>
            {enabled ? "Active" : "Off"}
          </span>
          <span
            className={`${styles.toggleTrack} ${enabled ? styles.toggleTrackOn : ""}`}
          >
            <span className={styles.toggleThumb} />
          </span>
        </label>
      </div>

      <div className={styles.content}>
        <div className={`${styles.sectionBody} ${!enabled ? styles.sectionBodyDisabled : ""}`}>
          {editingRuleId ? (
            <RuleEditForm
              editForm={editForm}
              setEditForm={setEditForm}
              onSave={handleSaveForm}
              onCancel={handleCancelForm}
              patternConflictMap={patternConflictMap}
              onEditConflictRule={handleEditRule}
            />
          ) : (
            <RuleList
              rules={localRules}
              onAdd={handleAddRule}
              onAddTemplate={handleAddTemplate}
              onEdit={handleEditRule}
              onDelete={handleDeleteRule}
              tabCountMap={groupTabCountMap}
            />
          )}
        </div>

        <PreviewGrid previewTabs={previewTabs} />
      </div>

      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.footerMeta}>
            {localRules.length} active rule{localRules.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className={styles.footerRight}>
          <button type="submit" className={styles.btnDone} disabled={!hasChanges || editingRuleId}>
            Save & Apply
          </button>
        </div>
      </div>
    </form>
    </>
  );
}
