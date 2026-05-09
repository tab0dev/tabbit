export const GROUP_COLORS = [
  { value: 'grey', label: 'Grey' },
  { value: 'blue', label: 'Blue' },
  { value: 'red', label: 'Red' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'pink', label: 'Pink' },
  { value: 'purple', label: 'Purple' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'orange', label: 'Orange' }
];

export const createNewRule = () => ({
  id: Date.now().toString(),
  patterns: [{ id: Date.now().toString(), value: "*://*.example.com/*", isRegex: false }],
  groupName: "New Group",
  groupColor: "grey",
  strict: true,
  merge: false,
});
