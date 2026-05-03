import React, { useState, useEffect, useRef } from 'react';
import { MagicWand, Plus } from '@phosphor-icons/react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { isDomainSplit } from '../../utils/domainPreferences';
import { MagicDotProvider, useMagicDot } from '../Tutorial/MagicDotProvider';
import MagicDot from '../Tutorial/MagicDot';
import AiOptInModal from './AiOptInModal';
import InfoIconWithTooltip from '../Shared/InfoIconWithTooltip';
import styles from './AutoTabGroupWizard.module.css';

import GroupRow from './AutoTabGroupWizard/GroupRow';
import TabRow from './AutoTabGroupWizard/TabRow';
import GroupNameInput from './AutoTabGroupWizard/GroupNameInput';
import { ATG_TUTORIAL_KEY, WIZARD_SEQUENCE } from './AutoTabGroupWizard/wizardTutorial';
import { useWizardState } from './AutoTabGroupWizard/useWizardState';
import { useWizardAi } from './AutoTabGroupWizard/useWizardAi';

export default function AutoTabGroupWizard({ onClose }) {
    return (
        <MagicDotProvider>
            <AutoTabGroupWizardInner onClose={onClose} />
        </MagicDotProvider>
    );
}

function AutoTabGroupWizardInner({ onClose }) {
    const { registerTarget } = useMagicDot();

    // show tutorial exactly once
    const [showTutorial] = useState(() => !localStorage.getItem(ATG_TUTORIAL_KEY));
    useEffect(() => {
        if (showTutorial) localStorage.setItem(ATG_TUTORIAL_KEY, '1');
    }, [showTutorial]);

    const leftPaneRef = useRef(null);
    const rightPaneRef = useRef(null);

    // all group/tab/dnd state
    const wiz = useWizardState({ onClose });

    // ai model management
    const ai = useWizardAi({
        activeTabs: wiz.activeTabs,
        buildGroups: wiz.buildGroups,
        domainPrefs: wiz.domainPrefs,
        setGroups: wiz.setGroups,
        setActiveGroupId: wiz.setActiveGroupId,
        setExcludedTabIds: wiz.setExcludedTabIds,
    });

    // dnd-kit sensors — require 6px movement before drag starts
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    // escape to close
    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopImmediatePropagation();
                onClose?.();
            }
        }
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    const draggedTab = wiz.dragItem ? wiz.tabById.get(wiz.dragItem.tabId) : null;
    const activeGroupTabs = wiz.activeGroup?.tabIds.map(id => wiz.tabById.get(id)).filter(Boolean) ?? [];
    const allTabsIncluded = activeGroupTabs.length > 0 && activeGroupTabs.every(t => !wiz.excludedTabIds.has(t.id));

    return (
        <DndContext
            sensors={sensors}
            onDragStart={wiz.handleDragStart}
            onDragOver={wiz.handleDragOver}
            onDragEnd={wiz.handleDragEnd}
            onDragCancel={wiz.handleDragCancel}
        >
            <div className={styles.wizard} style={{ position: 'relative' }}>
                {/* header */}
                <div className={styles.header}>
                    <div className={styles.title} ref={registerTarget('wiz-header')}>
                        <MagicWand size={14} weight="bold" /> Auto Tab Group
                        <InfoIconWithTooltip placement="right">Use AI or domain rules to automatically organize your tabs into logical groups.</InfoIconWithTooltip>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {ai.aiStatus !== 'unavailable' && ai.aiStatus !== 'checking' && (
                            <div className={styles.modeToggle}>
                                <button
                                    className={`${styles.modeBtn} ${ai.groupMode === 'brand' ? styles.modeBtnActive : ''}`}
                                    onClick={() => ai.setGroupMode('brand')}
                                >
                                    By domain
                                </button>
                                <button
                                    className={`${styles.modeBtn} ${ai.groupMode === 'ai' ? styles.modeBtnActive : ''}`}
                                    onClick={() => {
                                        if (ai.aiStatus === 'available' || ai.aiStatus === 'generating') {
                                            ai.setGroupMode('ai');
                                        } else if (ai.aiStatus === 'downloadable') {
                                            ai.setShowAiModal(true);
                                        }
                                    }}
                                    disabled={ai.aiStatus === 'downloading'}
                                    title={ai.aiStatus === 'downloading' ? 'AI model is downloading…' : undefined}
                                >
                                    ✦ AI
                                </button>
                            </div>
                        )}
                        <span className={styles.headerSubtitle}>
                            {wiz.groups.length} group{wiz.groups.length !== 1 ? 's' : ''} · {wiz.totalSelectedTabs} tab{wiz.totalSelectedTabs !== 1 ? 's' : ''} selected
                        </span>
                    </div>
                </div>

                {showTutorial && (
                    <MagicDot sequence={WIZARD_SEQUENCE} introDelay={600} />
                )}

                {ai.showAiModal && (
                    <AiOptInModal
                        isAlreadyDownloaded={ai.isModelPhysicallyAvailable}
                        onConfirm={() => {
                            ai.setShowAiModal(false);
                            localStorage.removeItem('ai_opt_in_revoked');
                            ai.setAiStatus('downloading');
                        }}
                        onCancel={() => {
                            ai.setShowAiModal(false);
                            ai.setGroupMode('brand');
                        }}
                    />
                )}

                {/* ai generating overlay */}
                {ai.aiStatus === 'generating' && (
                    <div className={styles.aiOverlay}>
                        <div className={styles.aiIndeterminateContainer}>
                            <div className={styles.aiIndeterminateShimmer} />
                        </div>
                        <span className={styles.aiOverlayText}>AI is analyzing tabs… this may take a few seconds.</span>
                        <button
                            className={styles.aiCancelBtn}
                            onClick={() => ai.setGroupMode('brand')}
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* two-pane body */}
                <div className={styles.body}>
                    {/* left pane — group list */}
                    <div
                        className={styles.leftPane}
                        ref={node => { leftPaneRef.current = node; registerTarget('wiz-left')(node); }}
                    >
                        {wiz.groups.map((g, idx) => {
                            const isSplit = g.rootDomain && isDomainSplit(g.rootDomain, wiz.domainPrefs);
                            const prev = wiz.groups[idx - 1];
                            const next = wiz.groups[idx + 1];
                            const isFirst = g.rootDomain && isSplit && (!prev || prev.rootDomain !== g.rootDomain);
                            const isLast = g.rootDomain && isSplit && (!next || next.rootDomain !== g.rootDomain);
                            const isSibling = g.rootDomain && isSplit;
                            const isHighlighted = g.rootDomain && (
                                g.rootDomain === wiz.hoveredRootDomain ||
                                (wiz.activeGroup?.rootDomain === g.rootDomain)
                            );

                            return (
                                <GroupRow
                                    key={g.id}
                                    group={g}
                                    active={wiz.activeGroupId === g.id}
                                    tabCount={wiz.tabCountForGroup(g)}
                                    totalCount={g.tabIds.length}
                                    isDraggingOver={wiz.overGroupId === g.id}
                                    onSelect={() => wiz.setActiveGroupId(g.id)}
                                    onToggle={() => wiz.toggleGroup(g.id)}
                                    onRename={newName => wiz.renameGroup(g.id, newName)}
                                    toggleRef={idx === 0 ? registerTarget('wiz-toggle') : undefined}
                                    splitLabel={g.subdomainCount > 1 && !isSplit ? `${g.subdomainCount} sites` : null}
                                    onToggleSplit={() => wiz.handleToggleSplit(g)}
                                    isSplit={isSplit}
                                    isSibling={isSibling}
                                    isFirstSibling={isFirst}
                                    isLastSibling={isLast}
                                    isHighlighted={isHighlighted}
                                    onMouseEnter={() => g.rootDomain && wiz.setHoveredRootDomain(g.rootDomain)}
                                    onMouseLeave={() => wiz.setHoveredRootDomain(null)}
                                />
                            );
                        })}
                        <button className={styles.addGroupBtn} onClick={wiz.addCustomGroup}>
                            <Plus size={12} weight="bold" />
                            New group
                        </button>
                    </div>

                    {/* right pane — tab list */}
                    <div
                        className={styles.rightPane}
                        ref={node => { rightPaneRef.current = node; registerTarget('wiz-right')(node); }}
                    >
                        {wiz.activeGroup ? (
                            <>
                                <div className={styles.rightPaneHeader}>
                                    <GroupNameInput
                                        rootDomain={wiz.activeGroup.rootDomain}
                                        name={wiz.activeGroup.name}
                                        isCustom={wiz.activeGroup.isCustom}
                                        onChange={name => wiz.renameGroup(wiz.activeGroupId, name)}
                                        registerTarget={registerTarget('wiz-name')}
                                    />
                                    {wiz.activeGroup.enabled && activeGroupTabs.length > 0 && (
                                        <button className={styles.rightPaneToggle} onClick={wiz.toggleAllInActive}>
                                            {allTabsIncluded ? 'Exclude all' : 'Include all'}
                                        </button>
                                    )}
                                </div>
                                <div className={styles.tabList}>
                                    {activeGroupTabs.length === 0 ? (
                                        <div className={styles.emptyTabDrop}>
                                            Drop tabs here to add them to this group
                                        </div>
                                    ) : (
                                        activeGroupTabs.map((tab, idx) => (
                                            <TabRow
                                                key={tab.id}
                                                tab={tab}
                                                groupId={wiz.activeGroup.id}
                                                excluded={!wiz.activeGroup.enabled || wiz.excludedTabIds.has(tab.id)}
                                                onToggleExclude={() => {
                                                    if (!wiz.activeGroup.enabled) return;
                                                    wiz.toggleExclude(tab.id);
                                                }}
                                                isDraggingThis={wiz.dragItem?.tabId === tab.id}
                                                dragRef={idx === 0 ? registerTarget('wiz-drag') : undefined}
                                            />
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className={styles.emptyState}>Select a group on the left</div>
                        )}
                    </div>
                </div>

                {/* ai attribution banner */}
                {ai.groupMode === 'ai' && ai.aiStatus === 'available' && (
                    <div className={styles.aiBanner}>
                        <span className={styles.aiBannerLabel}>
                            <span>✦</span> AI grouped by intent
                        </span>
                        <button
                            className={styles.aiRedoBtn}
                            onClick={() => ai.setAiGenCounter(c => c + 1)}
                        >
                            Redo
                        </button>
                    </div>
                )}

                {/* footer */}
                <div className={styles.footer}>
                    <div className={styles.footerLeft}>
                        {ai.aiStatus === 'downloading' ? (
                            <div className={styles.downloadIndicator}>
                                <svg className={styles.downloadRing} viewBox="0 0 24 24">
                                    <circle className={styles.downloadRingBg} cx="12" cy="12" r="10" />
                                    <circle
                                        className={styles.downloadRingFill}
                                        cx="12" cy="12" r="10"
                                        strokeDasharray={`${ai.downloadProgress * 62.83} 62.83`}
                                    />
                                </svg>
                                <span className={styles.footerMeta}>
                                    AI model {Math.round(ai.downloadProgress * 100)}%
                                </span>
                            </div>
                        ) : (
                            <span className={styles.footerMeta}>
                                {wiz.willCreateCount} group{wiz.willCreateCount !== 1 ? 's' : ''} will be created
                            </span>
                        )}
                    </div>
                    <div className={styles.footerRight}>
                        <button className={styles.btnCancel} onClick={onClose}>Cancel</button>
                        <button
                            ref={registerTarget('wiz-confirm')}
                            className={`${styles.btnConfirm} ${wiz.working ? styles.btnConfirmWorking : ''}`}
                            onClick={wiz.handleConfirm}
                            disabled={wiz.willCreateCount === 0 || wiz.working}
                        >
                            {wiz.working ? 'Creating…' : 'Create Groups'}
                        </button>
                    </div>
                </div>
            </div>

            {/* floating drag badge */}
            <DragOverlay dropAnimation={null}>
                {draggedTab ? (
                    <div className={styles.dragOverlay}>
                        {draggedTab.favIconUrl && (
                            <img src={draggedTab.favIconUrl} alt="" className={styles.dragOverlayFavicon} />
                        )}
                        {draggedTab.title || draggedTab.url}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
