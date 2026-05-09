import { parse } from 'tldts';

// strips protocol, www, ports, and paths — returns the bare hostname.
// canonical version used across picker history, auto grouping, and ai grouping.
// returns null for blank or unparseable urls.
export function extractBaseDomain(url) {
    if (!url) return null;
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}

const BRAND_MAP = {
    'youtube': 'YouTube',
    'facebook': 'Facebook',
    'google': 'Google',
    'github': 'GitHub',
    'gitlab': 'GitLab',
    'linkedin': 'LinkedIn',
    'whatsapp': 'WhatsApp',
};

const capitalize = (s) => {
    if (!s) return '';
    if (BRAND_MAP[s]) return BRAND_MAP[s];
    return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Extracts the registrable domain (e.g., 'youtube' from 'app.youtube.com' or 'google' from 'google.co.uk').
 * 
 * @param {string} hostname The hostname to parse (e.g., 'app.youtube.com')
 * @returns {string} The core domain name, capitalized nicely.
 */
export function extractRegistrableDomain(hostname) {
    if (!hostname) return 'Unknown';
    
    const parsed = parse(hostname, { allowPrivateDomains: true });
    
    if (parsed.domainWithoutSuffix) {
        return capitalize(parsed.domainWithoutSuffix);
    }
    
    // Fallback for single segments like "localhost"
    const segments = hostname.toLowerCase().split('.');
    return capitalize(segments[0]);
}

/**
 * Returns the full registrable domain (e.g., "google.com" from "mail.google.com",
 * "youtube.com" from "app.youtube.com", "google.co.uk" from "docs.google.co.uk").
 *
 * @param {string} hostname
 * @returns {string} The root domain including TLD, lowercased.
 */
export function extractRootDomain(hostname) {
    if (!hostname) return '';
    
    const h = hostname.toLowerCase().replace(/^www\./, '');
    const parsed = parse(h, { allowPrivateDomains: true });
    
    return parsed.domain || h;
}

/**
 * Extracts the meaningful subdomain prefix from a hostname.
 * e.g. "mail.google.com" → "mail", "company1.slack.com" → "company1",
 *      "google.com" → null (no subdomain).
 *
 * @param {string} hostname
 * @returns {string|null}
 */
export function extractSubdomainLabel(hostname) {
    if (!hostname) return null;
    
    const h = hostname.toLowerCase().replace(/^www\./, '');
    const parsed = parse(h, { allowPrivateDomains: true });
    
    return parsed.subdomain || null;
}
