import { useTriage } from '../store/TriageProvider';
import { TriageTab } from '../types';

export interface ProgressStats {
  totalTabs: number;
  processedTabs: number;
  progressPercent: number;
  progressRatio: number;
}

export function useProgress(filterFn: ((tab: TriageTab) => boolean) | null = null): ProgressStats {
  const { state } = useTriage();

  const visibleTabs = filterFn ? state?.tabs?.filter(filterFn) : state?.tabs;

  const totalTabs =
    visibleTabs?.reduce((acc: number, t: TriageTab) => {
      return acc + 1 + (t.duplicates?.length || 0);
    }, 0) || 0;

  const processedTabs =
    visibleTabs?.reduce((acc: number, t: TriageTab) => {
      if (t.processed || t.gone) {
        return acc + 1 + (t.duplicates?.length || 0);
      }
      return acc;
    }, 0) || 0;

  const progressPercent = totalTabs > 0 ? (processedTabs / totalTabs) * 100 : 0;
  const progressRatio = totalTabs > 0 ? processedTabs / totalTabs : 0;

  return {
    totalTabs,
    processedTabs,
    progressPercent,
    progressRatio,
  };
}
