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
    const [isModelDownloaded, setIsModelDownloaded] = useState(false);
    const [aiPhase, setAiPhase] = useState('idle'); // 'idle' | 'initializing' | 'inferencing' | 'parsing'

    // check ai availability on mount
    useEffect(() => {
        let cancelled = false;
        console.log('[useWizardAi] Checking AI availability on mount...');
        isAiAvailable().then(result => {
            if (cancelled) return;
            const isOptedIn = localStorage.getItem('ai_opt_in') === 'true';
            const isDownloadRequested = localStorage.getItem('ai_download_requested') === 'true';
            console.log('[useWizardAi] isAiAvailable result:', result, 'isOptedIn:', isOptedIn, 'isDownloadRequested:', isDownloadRequested);

            const isHardwareSupported = result.available || result.downloading || result.downloadable;
            setIsModelPhysicallyAvailable(isHardwareSupported);
            setIsModelDownloaded(result.available);

            if (!isHardwareSupported) {
                console.log('[useWizardAi] Setting status to unavailable');
                setAiStatus('unavailable');
            } else if (isOptedIn && result.available) {
                console.log('[useWizardAi] Setting status to available');
                setAiStatus('available');
            } else if (isOptedIn && isDownloadRequested && (result.downloading || result.downloadable)) {
                // If opted in and requested download, but not available, it should be downloading
                console.log('[useWizardAi] Setting status to downloading');
                setAiStatus('downloading');
            } else {
                // Supported, but either not opted in or download not requested. Click should show modal.
                console.log('[useWizardAi] Setting status to downloadable (requires opt in / download request)');
                setAiStatus('downloadable');
            }
        });
        return () => { cancelled = true; };
    }, []);

    // download progress tracking
    useEffect(() => {
        console.log('[useWizardAi] download progress tracking effect running. aiStatus:', aiStatus);
        if (aiStatus !== 'downloading') return;
        const controller = new AbortController();

        console.log('[useWizardAi] initiating downloadModel...');
        downloadModel(
            (progress) => {
                console.log('[useWizardAi] download progress updated:', progress);
                setDownloadProgress(progress);
            },
            { signal: controller.signal }
        )
            .then(() => {
                console.log('[useWizardAi] downloadModel resolved. Setting available and AI mode.');
                setAiStatus('available');
                setDownloadProgress(1);
                setGroupMode('ai');
            })
            .catch(err => {
                if (err.name === 'AbortError') {
                    console.log('[useWizardAi] download aborted.');
                    return;
                }
                console.warn('[Tabbit] Model download failed:', err);
                setAiStatus('unavailable');
            });

        return () => {
            console.log('[useWizardAi] aborting download controller');
            controller.abort();
        };
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
        isModelDownloaded,
        aiPhase, setAiPhase,
    };
}
