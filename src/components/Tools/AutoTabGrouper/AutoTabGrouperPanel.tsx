import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Magnet } from '@phosphor-icons/react';
import styles from './AutoTabGrouperPanel.module.css';
import { useTriage } from '../../../store/TriageProvider';
import { useTabProcessing } from '../../../store/TabProcessingProvider';
import { useAutoGrouper } from '../../../hooks/useAutoGrouper';
import { useTriageActions } from '../../../hooks/useTriageActions';
import { generateMatcherRegex, evaluateRoughMatch } from '../../../utils/matcherRegex';
import InfoIconWithTooltip from '../../Shared/InfoIconWithTooltip';
import { useMonitor } from '../../../store/MonitorProvider';
import { pickQuip, GROUPER_QUIPS } from '../../../constants/quips';
import { MagicDotProvider, useMagicDot } from '../../Tutorial/MagicDotProvider';
import MagicDot from '../../Tutorial/MagicDot';
import { useTutorialSequence } from '../../Tutorial/useTutorialSequence';
import { TriageTab, GroupId, ChromeTabGroup } from '../../../types';

import RuleEditForm from './RuleEditForm';
import RuleList from './RuleList';
import PreviewGrid from './PreviewGrid';
import ApplyTabsModal from '../../Modals/ApplyTabsModal';
import { PRESET_TEMPLATES } from './templates';

export interface AutoTabGrouperPanelProps {
  onClose: () => void;
}
export default function AutoTabGrouperPanel({ onClose }: AutoTabGrouperPanelProps) {
  return (
    <MagicDotProvider>
      <AutoTabGrouperWorkerPanelInner onClose={onClose} />
    </MagicDotProvider>
  );
}

function AutoTabGrouperWorkerPanelInner({ onClose }: { onClose: () => void }) {
  const { registerTarget } = useMagicDot();
  const { showTutorial, sequence } = useTutorialSequence('auto-grouper');

  const { state, dispatch } = useTriage();
  const { excludeSuspendedTabs, excludeGroupedTabs } = useTabProcessing();
  const { group: groupAction, groupBatch } = useTriageActions();
  const { postStatus } = useMonitor();
  const { settings, updateSettings, rules, updateRules, loading } = useAutoGrouper();

  const [enabled, setEnabled] = useState<boolean>(settings.enabled);
  const [localRules, setLocalRules] = useState<
    import('../../../hooks/useAutoGrouper').AutoGrouperRule[]
  >([]);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<
    import('../../../hooks/useAutoGrouper').AutoGrouperRule | null
  >(null);
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [pendingApplyTabs, setPendingApplyTabs] = useState<import('../../../types').TriageTab[]>(
    [],
  );

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
    state.tabs.forEach((tab) => {
      const gid = tab.groupId ?? -1;
      if (gid === -1 || tab.gone) return;
      state.tabGroups.forEach((g) => {
        if (g.id === gid) {
          map.set(g.title, (map.get(g.title) ?? 0) + 1);
        }
      });
    });
    return map;
  }, [state.tabs, state.tabGroups]);

  const handleSubmit = async (e: React.FormEvent) => {
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

    postStatus(`Auto Tab Grouper updated.\n${pickQuip(GROUPER_QUIPS.save)}`, { level: 'success' });
    onClose();
  };

  // The preview matches tabs against the currently edited rule (if editing),
  // OR against all local rules (if not editing).
  // Tabs already sitting in their target group are excluded from both paths.
  const previewTabs = useMemo(() => {
    if (!state.tabs) return [];

    // Respect the global "Exclude Suspended Tabs" setting — isSuspended is
    // already stamped on each tab by triageLoader.js, so no new plumbing needed.
    const visibleTabs = state.tabs.filter((tab) => {
      if (excludeSuspendedTabs && tab.isSuspended) return false;
      if (excludeGroupedTabs && tab.groupId !== -1) return false;
      return true;
    });

    // A tab is already correctly grouped if a Chrome tab group exists with
    // the same title as the rule's groupName AND the tab is in that group.
    const isAlreadyGrouped = (tab: TriageTab, ruleName: string) => {
      const targetGroup = state.tabGroups.find((g) => g.title === ruleName);
      return !!(targetGroup && tab.groupId === targetGroup.id);
    };

    if (editingRuleId && editForm) {
      const patterns = editForm.patterns || [];
      const regexPatterns = patterns.filter(
        (p: import('../../../hooks/useAutoGrouper').AutoGrouperPattern) => p.type !== 'rough',
      );
      const roughPatterns = patterns.filter(
        (p: import('../../../hooks/useAutoGrouper').AutoGrouperPattern) => p.type === 'rough',
      ) as Extract<import('../../../hooks/useAutoGrouper').AutoGrouperPattern, { type: 'rough' }>[];

      const compiledRegexes = regexPatterns
        .map((p: import('../../../hooks/useAutoGrouper').AutoGrouperPattern) =>
          generateMatcherRegex(p.value, p.isRegex, p.type),
        )
        .filter(Boolean) as RegExp[];

      return visibleTabs
        .filter((tab) => {
          if (!tab.url) return false;
          let isMatch = compiledRegexes.some((r: RegExp) => r.test(tab.url!));
          if (!isMatch) {
            isMatch = roughPatterns.some((rough) => evaluateRoughMatch(rough, tab));
          }
          return isMatch && !isAlreadyGrouped(tab, editForm.groupName);
        })
        .map((tab) => ({ ...tab, matchedRule: editForm }));
    }

    // Match against all rules
    const matched = [];
    for (const tab of visibleTabs) {
      if (!tab.url) continue;
      for (const rule of localRules) {
        const patterns = rule.patterns || [
          { id: 'legacy', value: rule.pattern!, isRegex: rule.isRegex!, type: 'url' },
        ];
        const regexPatterns = patterns.filter(
          (p: import('../../../hooks/useAutoGrouper').AutoGrouperPattern) => p.type !== 'rough',
        );
        const roughPatterns = patterns.filter(
          (p: import('../../../hooks/useAutoGrouper').AutoGrouperPattern) => p.type === 'rough',
        ) as Extract<
          import('../../../hooks/useAutoGrouper').AutoGrouperPattern,
          { type: 'rough' }
        >[];

        const compiledRegexes = regexPatterns
          .map((p: import('../../../hooks/useAutoGrouper').AutoGrouperPattern) =>
            generateMatcherRegex(p.value, p.isRegex, p.type),
          )
          .filter(Boolean) as RegExp[];

        let isMatch = compiledRegexes.some((r: RegExp) => r.test(tab.url!));
        if (!isMatch) {
          isMatch = roughPatterns.some((rough) => evaluateRoughMatch(rough, tab));
        }

        if (isMatch && !isAlreadyGrouped(tab, rule.groupName)) {
          matched.push({ ...tab, matchedRule: rule });
          break;
        }
      }
    }
    return matched;
  }, [
    state.tabs,
    state.tabGroups,
    editingRuleId,
    editForm,
    localRules,
    excludeSuspendedTabs,
    excludeGroupedTabs,
  ]);

  // Detects conflicts between the patterns in the form being edited and tabs
  // already physically sitting inside a Chrome tab group owned by a different rule.
  // Map<patternId, { rule: conflictingRule, tabs: conflictingTabs[] }>
  const patternConflictMap = useMemo(() => {
    if (!editingRuleId || !editForm || !enabled) return new Map();
    const result = new Map();

    for (const pattern of editForm.patterns ?? []) {
      if (pattern.type === 'rough') continue; // rough match excluded from conflict detection
      const regex = generateMatcherRegex(pattern.value, pattern.isRegex, pattern.type);
      if (!regex) continue; // invalid syntax — ValidationIcon already shows ❌

      for (const rule of localRules) {
        if (rule.id === editingRuleId) continue; // don't self-conflict
        const targetGroup = state.tabGroups.find((g) => g.title === rule.groupName);
        if (!targetGroup) continue; // rule has no live Chrome group yet

        const conflictingTabs = state.tabs.filter(
          (tab) => tab.groupId === targetGroup.id && !tab.gone && tab.url && regex.test(tab.url),
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
      const matchedRule = (
        tab as import('../../../types').TriageTab & {
          matchedRule: import('../../../hooks/useAutoGrouper').AutoGrouperRule;
        }
      ).matchedRule;
      const ruleId = matchedRule.id;
      if (!byRule.has(ruleId)) byRule.set(ruleId, { rule: matchedRule, tabs: [] });
      byRule.get(ruleId).tabs.push(tab);
    }

    for (const { rule, tabs } of byRule.values()) {
      // Check for an existing Chrome tab group with matching name
      const existing = state.tabGroups.find((g) => g.title === rule.groupName);

      if (existing) {
        // ── Path A: merge into existing group (uses groupBatch for cross-window safety) ──
        await groupBatch(tabs, existing.id);
      } else {
        // ── Path B: create new group (mirrors TabGroupPickerPanel.createTabGroup) ──
        try {
          const tabIds = tabs.map((t: import('../../../types').TriageTab) => t.id);
          const groupId = (await chrome.tabs.group({ tabIds })) as GroupId;
          await chrome.tabGroups.update(groupId, {
            title: rule.groupName,
            color: rule.groupColor,
          });
          const newGroup: ChromeTabGroup = {
            id: groupId,
            title: rule.groupName,
            color: rule.groupColor,
            windowId: tabs[0].windowId,
          };
          dispatch({ type: 'ADD_TAB_GROUP', payload: newGroup });
          // groupAction per tab: pushes to globalChromeUndoStack + dispatches PROCESS_TAB
          // chrome.tabs.group call inside groupAction is a no-op for tabs already in the group
          tabs.forEach((tab: TriageTab) => groupAction(tab, groupId, true));
        } catch (err) {
          console.warn('[Tabbit] ApplyTabsModal: failed to create tab group:', err);
        }
      }
    }

    const count = pendingApplyTabs.length;
    postStatus(
      `✓ ${count} tab${count !== 1 ? 's' : ''} moved to their groups.\n${pickQuip(GROUPER_QUIPS.apply)}`,
      { level: 'success' },
    );
    onClose();
  }, [pendingApplyTabs, state.tabGroups, groupAction, groupBatch, dispatch, onClose, postStatus]);

  const handleApplySkip = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleAddRule = () => {
    const newRule = {
      id: Date.now().toString(),
      patterns: [{ id: Date.now().toString(), value: '', type: 'simple', isRegex: false }],
      groupName: 'New Group',
      groupColor: 'grey' as chrome.tabGroups.Color,
      strict: true,
      merge: false,
    };
    setEditForm(newRule);
    setEditingRuleId(newRule.id);
  };

  const handleAddTemplate = (action: {
    id?: string;
    type?: string;
    baseId?: string;
    variantId?: string;
  }) => {
    if (action && action.type === 'merge') {
      const base = PRESET_TEMPLATES.find((t) => t.id === action.baseId);
      const variant = PRESET_TEMPLATES.find((t) => t.id === action.variantId);
      if (!base || !variant) return;
      const mergedPatterns = [...base.patterns, ...variant.patterns];
      const newRule = {
        id: Date.now().toString(),
        groupName: base.groupName,
        groupColor: (base.groupColor as chrome.tabGroups.Color) || 'grey',
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
    const template = PRESET_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const newRule = {
      id: Date.now().toString(),
      groupName: template.groupName,
      groupColor: (template.groupColor as chrome.tabGroups.Color) || 'grey',
      strict: template.strict,
      merge: template.merge,
      patterns: template.patterns.map((p, idx) => ({ ...p, id: `${Date.now()}-${idx}` })),
    };
    setEditForm(newRule);
    setEditingRuleId(newRule.id);
  };

  const handleEditRule = (rule: import('../../../hooks/useAutoGrouper').AutoGrouperRule) => {
    const patterns = rule.patterns || [
      { id: Date.now().toString(), value: rule.pattern || '', isRegex: rule.isRegex || false },
    ];
    setEditForm({ ...rule, patterns });
    setEditingRuleId(rule.id);
  };

  const handleDeleteRule = (id: string) => {
    setLocalRules(
      localRules.filter(
        (r: import('../../../hooks/useAutoGrouper').AutoGrouperRule) => r.id !== id,
      ),
    );
  };

  const handleSaveForm = () => {
    if (!editForm || !editForm.patterns || editForm.patterns.length === 0 || !editForm.groupName)
      return;
    const cleanedPatterns = editForm.patterns!.filter(
      (p: import('../../../hooks/useAutoGrouper').AutoGrouperPattern) => p.value.trim() !== '',
    );
    if (cleanedPatterns.length === 0) return;

    const ruleToSave = { ...editForm, patterns: cleanedPatterns };

    const exists = localRules.some((r) => r.id === ruleToSave.id);
    if (exists) {
      setLocalRules(
        localRules.map((r) =>
          r.id === ruleToSave.id
            ? (ruleToSave as import('../../../hooks/useAutoGrouper').AutoGrouperRule)
            : r,
        ),
      );
    } else {
      setLocalRules([
        ...localRules,
        ruleToSave as import('../../../hooks/useAutoGrouper').AutoGrouperRule,
      ]);
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
        {showTutorial && <MagicDot sequence={sequence} introDelay={600} />}
        <div className={styles.header}>
          <span className={styles.title} ref={registerTarget('ag-header')}>
            <Magnet size={16} weight="duotone" />
            Auto Tab Grouper
            <InfoIconWithTooltip placement="right">
              Runs in the background and automatically puts new tabs into groups based on custom URL
              match patterns or regex.
            </InfoIconWithTooltip>
          </span>
          <label
            className={styles.enableToggle}
            title={enabled ? 'Disable auto-grouper' : 'Enable auto-grouper'}
            ref={registerTarget('ag-toggle')}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className={styles.toggleInput}
            />
            <span className={styles.toggleLabel}>{enabled ? 'Active' : 'Off'}</span>
            <span className={`${styles.toggleTrack} ${enabled ? styles.toggleTrackOn : ''}`}>
              <span className={styles.toggleThumb} />
            </span>
          </label>
        </div>

        <div className={styles.content}>
          <div
            className={`${styles.sectionBody} ${!enabled ? styles.sectionBodyDisabled : ''}`}
            ref={registerTarget('ag-rules')}
          >
            {editingRuleId ? (
              <RuleEditForm
                editForm={editForm as import('../../../hooks/useAutoGrouper').AutoGrouperRule}
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
                registerTarget={registerTarget}
              />
            )}
          </div>

          <PreviewGrid
            previewTabs={previewTabs}
            rootRef={registerTarget('ag-preview') as React.Ref<HTMLDivElement>}
          />
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <span className={styles.footerMeta}>
              {localRules.length} active rule{localRules.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className={styles.footerRight}>
            <button
              type="submit"
              className={styles.btnDone}
              disabled={!hasChanges || !!editingRuleId}
              ref={registerTarget('ag-save')}
            >
              Save & Apply
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
