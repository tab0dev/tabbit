export const getAccessPillProps = (timestamp) => {
  if (!timestamp) return null;
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = diff / (1000 * 60 * 60 * 24);

  let text = '';
  if (mins < 1) text = 'Just now';
  else if (mins < 60) text = `${mins}m ago`;
  else if (hrs < 24) text = `${hrs}h ago`;
  else text = `${Math.floor(days)}d ago`;

  let style = {
    color: 'var(--pill-text-color)',
    backgroundColor: 'var(--pill-green-bg)',
    borderColor: 'var(--pill-green-border)',
  };

  if (days >= 4) {
    style.backgroundColor = 'var(--pill-red-bg)';
    style.borderColor = 'var(--pill-red-border)';
  } else if (days >= 1) {
    style.backgroundColor = 'var(--pill-yellow-bg)';
    style.borderColor = 'var(--pill-yellow-border)';
  }

  return { text, style };
};

export const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  return `${s}s`;
};

export const extractDomain = (url) => {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
};

// formats a timestamp into a compact relative string like "5m ago", "2h ago", "3d ago".
// used in graveyard entries, tab age labels, etc.
export function relativeTime(ms) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
