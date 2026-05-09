function sanitizeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateMatcherRegex(matcher, isRegex, matchType = null) {
  if (!matcher) return null;
  
  const type = matchType || (isRegex ? 'regex' : 'pattern');
  
  if (type === 'simple') {
    let cleaned = matcher.trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./i, '');
    matcher = `*://*.${cleaned}/*`;
  }
  
  if (type === 'regex' || isRegex) {
    try {
      // Support patterns like /regex/i or just regex
      if (matcher.startsWith('/') && matcher.lastIndexOf('/') > 0) {
        const lastSlash = matcher.lastIndexOf('/');
        const flags = matcher.substring(lastSlash + 1);
        const pattern = matcher.substring(1, lastSlash);
        return new RegExp(pattern, flags);
      }
      return new RegExp(matcher);
    } catch (e) {
      return null; // Invalid regex
    }
  }
  
  if (matcher === '*') return /^.*$/i;

  const splitPattern = matcher.split("://");
  let scheme = splitPattern[0];
  let rest = splitPattern.slice(1).join("://");
  
  // if no scheme provided
  if (!rest) {
      rest = scheme;
      scheme = "*";
  }

  let schemePattern = scheme === "*" ? "https?" : sanitizeRegex(scheme);

  const pathIdx = rest.indexOf("/");
  let host = pathIdx > -1 ? rest.substring(0, pathIdx) : rest;
  let path = pathIdx > -1 ? rest.substring(pathIdx) : "/*";

  let hostPattern;
  if (host === "*") {
      hostPattern = "[^/]+";
  } else if (host.startsWith("*.")) {
      hostPattern = "(?:[^/]+\\.)?" + sanitizeRegex(host.slice(2));
  } else {
      hostPattern = sanitizeRegex(host);
  }
  // Add port wildcard if no port specified
  if (!/:[0-9]+$/.test(host)) {
      hostPattern += "(?::[0-9]+)?";
  }

  let pathPattern;
  if (path === "/*") {
      pathPattern = "(?:/.*)?";
  } else {
      pathPattern = path.split('*').map(sanitizeRegex).join('.*');
  }

  try {
      return new RegExp(`^${schemePattern}://${hostPattern}${pathPattern}$`, 'i');
  } catch (e) {
      return null;
  }
}

export function evaluateRoughMatch(pattern, tab) {
  if (!pattern || pattern.type !== 'rough') return false;
  
  const { target, method, value } = pattern;
  if (!value) return false;
  
  let subject = '';
  if (target === 'hostname' || target === 'href') {
    if (!tab.url) return false;
    try {
      const urlObj = new URL(tab.url);
      subject = target === 'hostname' ? urlObj.hostname : urlObj.href;
    } catch { return false; }
  } else if (target === 'title' || target === 'title_ignorecase') {
    subject = tab.title || '';
  }

  let checkVal = value || '';
  let subj = subject;
  if (target === 'title_ignorecase') {
    subj = subject.toLowerCase();
    checkVal = checkVal.toLowerCase();
  }

  switch (method) {
    case 'includes': return subj.includes(checkVal);
    case 'startsWith': return subj.startsWith(checkVal);
    case 'endsWith': return subj.endsWith(checkVal);
    case 'equals': return subj === checkVal;
    default: return false;
  }
}
