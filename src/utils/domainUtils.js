import { MULTI_SEGMENT_SUFFIXES } from '../data/publicSuffixes.js';

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

/**
 * Extracts the registrable domain (e.g., 'youtube' from 'app.youtube.com' or 'google' from 'google.co.uk').
 * 
 * @param {string} hostname The hostname to parse (e.g., 'app.youtube.com')
 * @returns {string} The core domain name, capitalized nicely.
 */
export function extractRegistrableDomain(hostname) {
    if (!hostname) return 'Unknown';

    const segments = hostname.toLowerCase().split('.');
    
    const capitalize = (s) => {
        if (BRAND_MAP[s]) return BRAND_MAP[s];
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

    if (segments.length <= 1) return capitalize(hostname);

    let suffixSegments = 1; // Default to single segment TLD (.com, .org)
    
    // Check for multi-segment suffixes
    for (const suffix of MULTI_SEGMENT_SUFFIXES) {
        if (hostname.endsWith(`.${suffix}`)) {
            suffixSegments = suffix.split('.').length;
            break;
        }
    }

    // The domain name is the segment immediately preceding the suffix
    const domainIndex = segments.length - suffixSegments - 1;
    
    if (domainIndex >= 0) {
        return capitalize(segments[domainIndex]);
    }

    // Fallback: take the first segment
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
    const segments = h.split('.');

    if (segments.length <= 2) return h;

    let suffixSegments = 1;
    for (const suffix of MULTI_SEGMENT_SUFFIXES) {
        if (h.endsWith(`.${suffix}`)) {
            suffixSegments = suffix.split('.').length;
            break;
        }
    }

    // registrable domain = brand segment + suffix
    const domainIndex = segments.length - suffixSegments - 1;
    return segments.slice(Math.max(0, domainIndex)).join('.');
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
    const root = extractRootDomain(h);
    if (!root || h === root) return null;

    // Everything before the root domain
    const prefix = h.slice(0, h.length - root.length - 1); // strip trailing '.'
    return prefix || null;
}
