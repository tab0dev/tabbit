import { useTriage } from '../../../store/TriageProvider';
import { GROUP_COLORS } from '../../Overlay/TabGroupPickerPanel';

export function useTabGroup(tab) {
  const { state } = useTriage();

  const tabGroup = (tab?.groupId && tab?.groupId !== -1)
    ? state.tabGroups.find(g => g.id === tab.groupId)
    : null;

  const groupColor = tabGroup ? (GROUP_COLORS[tabGroup.color] || GROUP_COLORS.grey) : null;

  return { tabGroup, groupColor };
}
