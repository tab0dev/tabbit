import { useState, useEffect } from 'react';
import { isAiAvailable, suggestGroups, downloadModel } from '../../../services/aiGroupingService';
import '../../../services/aiEvaluationSuite';

// hook to manage AI model availability, download progress, and AI-driven
// group generation.
export function useWizardAi({ activeTabs, buildGroups, domainPrefs, setGroups, setActiveGroupId, setExcludedTabIds }) {
    // aiStatus: 'checking' | 'available' | 'unavailable' | 'generating' | 'error' | 'downloading' | 'downloadable'
    const [aiStatus, setAiStatus] = useState('checking');
    const [groupMode, setGroupMode] = useState('brand'); // 'brand' | 'ai'
    const [aiGenCounter, setAiGenCounter] = useState(0);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [showAiModal, setShowAiModal] = useState(false);
    const [isModelPhysicallyAvailable, setIsModelPhysicallyAvailable] = useState(false);
    const [aiPhase, setAiPhase] = useState('idle'); // 'idle' | 'initializing' | 'inferencing' | 'parsing'

    // check ai availability on mount
    useEffect(() => {
        let cancelled = false;
        isAiAvailable().then(result => {
            if (cancelled) return;
            const isRevoked = localStorage.getItem('ai_opt_in_revoked') === 'true';

            setIsModelPhysicallyAvailable(result.available);

            if (result.available && !isRevoked) {
                setAiStatus('available');
            } else if (result.downloading) {
                setAiStatus('downloading');
            } else if (result.downloadable || (result.available && isRevoked)) {
                setAiStatus('downloadable');
            } else {
                setAiStatus('unavailable');
            }
        });
        return () => { cancelled = true; };
    }, []);

    // download progress tracking
    useEffect(() => {
        if (aiStatus !== 'downloading') return;
        const controller = new AbortController();

        downloadModel(
            (progress) => setDownloadProgress(progress),
            { signal: controller.signal }
        )
            .then(() => {
                setAiStatus('available');
                setDownloadProgress(1);
                setGroupMode('ai');
            })
            .catch(err => {
                if (err.name === 'AbortError') return;
                console.warn('[Tabbit] Model download failed:', err);
                setAiStatus('unavailable');
            });

        return () => controller.abort();
    }, [aiStatus]);

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
        aiStatus, setAiStatus,
        groupMode, setGroupMode,
        aiGenCounter, setAiGenCounter,
        downloadProgress,
        showAiModal, setShowAiModal,
        isModelPhysicallyAvailable,
        aiPhase, setAiPhase,
    };
}
