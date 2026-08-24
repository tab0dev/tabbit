import { useState, useEffect } from 'react';
import { suggestGroups } from '../../../services/aiGroupingService';
import '../../../services/aiEvaluationSuite';
import { useAiAvailability } from '../../../hooks/useAiAvailability';

// hook to manage AI model availability, download progress, and AI-driven
// group generation.
export function useWizardAi({ activeTabs, buildGroups, domainPrefs, setGroups, setActiveGroupId, setExcludedTabIds }) {
    const aiAvailability = useAiAvailability();
    const { aiStatus, setAiStatus } = aiAvailability;
    const [groupMode, setGroupMode] = useState('brand'); // 'brand' | 'ai'
    const [aiGenCounter, setAiGenCounter] = useState(0);
    const [aiPhase, setAiPhase] = useState('idle'); // 'idle' | 'initializing' | 'inferencing' | 'parsing'

    // re-generate groups when mode changes or "Redo" is clicked
    useEffect(() => {
        if (groupMode === 'brand') {
            setAiStatus(prev => (prev === 'generating' || prev === 'error') ? 'available' : prev);
            const freshGroups = buildGroups(domainPrefs);
            setGroups(freshGroups);
            setActiveGroupId(freshGroups[0]?.id ?? null);
            return;
        }

        if (groupMode === 'ai' && (aiStatus === 'available' || aiStatus === 'generating')) {
            const controller = new AbortController();
            setAiStatus('generating');
            setAiPhase('initializing');

            suggestGroups(activeTabs, { 
                signal: controller.signal,
                onPhaseChange: setAiPhase 
            })
                .then(aiGroups => {
                    const seeded = aiGroups.map((g, i) => ({
                        id: `ai-${i}-${Date.now()}`,
                        name: g.name,
                        tabIds: g.tabs.map(t => t.id),
                        favicon: g.tabs[0]?.favIconUrl || null,
                        isCustom: false,
                        enabled: true,
                        rootDomain: null,
                        canSplit: false,
                        subdomainCount: 0,
                        subdomainNames: [],
                    }));
                    setGroups(seeded);
                    setActiveGroupId(seeded[0]?.id ?? null);
                    setExcludedTabIds(new Set());
                    setAiStatus('available');
                })
                .catch(err => {
                    if (err.name === 'AbortError') return;
                    console.warn('[Tabbit] AI grouping failed, falling back to brand-first:', err);
                    setAiStatus('error');
                    setGroupMode('brand');
                    setGroups(buildGroups(domainPrefs));
                })
                .finally(() => {
                    setAiPhase('idle');
                });

            return () => controller.abort();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupMode, aiGenCounter]);

    return {
        ...aiAvailability,
        groupMode, setGroupMode,
        aiGenCounter, setAiGenCounter,
        aiPhase, setAiPhase,
    };
}
