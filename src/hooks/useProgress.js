import { useTriage } from '../store/TriageProvider';

export function useProgress(filterFn = null) {
  const { state } = useTriage();

  const visibleTabs = filterFn ? state?.tabs?.filter(filterFn) : state?.tabs;

  const totalTabs = visibleTabs?.reduce((acc, t) => {
    return acc + 1 + (t.duplicates?.length || 0);
  }, 0) || 0;

  const processedTabs = visibleTabs?.reduce((acc, t) => {
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
    progressRatio
  };
}
