/**
 * domainGrouping.test.js
 *
 * Standalone test suite for the brand-first domain grouping system.
 * Run with:  node src/tests/domainGrouping.test.js
 *
 * No test framework required — uses a minimal inline runner.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Minimal test runner
// ─────────────────────────────────────────────────────────────────────────────

let _pass = 0, _fail = 0, _currentSuite = '';

function suite(name) { _currentSuite = name; console.log(`\n\x1b[1m▸ ${name}\x1b[0m`); }

function test(name, fn) {
    try {
        fn();
        _pass++;
        console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (e) {
        _fail++;
        console.log(`  \x1b[31m✗\x1b[0m ${name}`);
        console.log(`    \x1b[31m${e.message}\x1b[0m`);
    }
}

function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        },
        toEqual(expected) {
            const a = JSON.stringify(actual), b = JSON.stringify(expected);
            if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
        },
        toBeNull() {
            if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
        },
        toBeTruthy() {
            if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
        },
        toBeFalsy() {
            if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
        },
        toContain(item) {
            if (!actual.includes(item)) throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
        },
        toHaveLength(len) {
            if (actual.length !== len) throw new Error(`Expected length ${len}, got ${actual.length}`);
        },
        toBeGreaterThanOrEqual(n) {
            if (actual < n) throw new Error(`Expected ${actual} >= ${n}`);
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock localStorage for Node (domainPreferences uses it)
// ─────────────────────────────────────────────────────────────────────────────

const _store = {};
globalThis.localStorage = {
    getItem: (k) => _store[k] ?? null,
    setItem: (k, v) => { _store[k] = String(v); },
    removeItem: (k) => { delete _store[k]; },
    clear: () => { for (const k in _store) delete _store[k]; },
};

// ─────────────────────────────────────────────────────────────────────────────
// Imports (ESM)
// ─────────────────────────────────────────────────────────────────────────────

import {
    extractRegistrableDomain,
    extractRootDomain,
    extractSubdomainLabel,
} from '../utils/domainUtils.js';

import {
    loadDomainPreferences,
    saveDomainPreference,
    isDomainSplit,
} from '../utils/domainPreferences.js';

import {
    extractBaseDomain,
    findCommonTitlePrefix,
    buildSubdomainName,
    buildDomainGroups,
    buildDistinctGroupName,
} from '../services/autoTabGroupService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers to build fake Chrome tabs
// ─────────────────────────────────────────────────────────────────────────────

let _tabId = 1;
function tab(url, title = '', favIconUrl = null) {
    return { id: _tabId++, url, title, favIconUrl, windowId: 1 };
}

function resetTabs() { _tabId = 1; }

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

// ─── extractRegistrableDomain ────────────────────────────────────────────────

suite('extractRegistrableDomain');

test('simple .com domain', () => {
    expect(extractRegistrableDomain('example.com')).toBe('Example');
});

test('subdomain is stripped — returns brand name', () => {
    expect(extractRegistrableDomain('app.youtube.com')).toBe('YouTube');
});

test('mail.google.com returns Google', () => {
    expect(extractRegistrableDomain('mail.google.com')).toBe('Google');
});

test('docs.google.com returns Google', () => {
    expect(extractRegistrableDomain('docs.google.com')).toBe('Google');
});

test('deep subdomain — team.dev.company.com returns Company', () => {
    expect(extractRegistrableDomain('team.dev.company.com')).toBe('Company');
});

test('multi-segment TLD — google.co.uk returns Google', () => {
    expect(extractRegistrableDomain('google.co.uk')).toBe('Google');
});

test('multi-segment TLD with subdomain — docs.google.co.uk returns Google', () => {
    expect(extractRegistrableDomain('docs.google.co.uk')).toBe('Google');
});

test('brand map — github.com returns GitHub (casing)', () => {
    expect(extractRegistrableDomain('github.com')).toBe('GitHub');
});

test('brand map — linkedin.com returns LinkedIn', () => {
    expect(extractRegistrableDomain('linkedin.com')).toBe('LinkedIn');
});

test('null/empty input returns Unknown', () => {
    expect(extractRegistrableDomain(null)).toBe('Unknown');
    expect(extractRegistrableDomain('')).toBe('Unknown');
});

test('single segment (localhost) capitalizes', () => {
    expect(extractRegistrableDomain('localhost')).toBe('Localhost');
});

test('.com.br multi-segment TLD', () => {
    expect(extractRegistrableDomain('empresa.com.br')).toBe('Empresa');
});

test('subdomain with .co.jp TLD', () => {
    expect(extractRegistrableDomain('shop.rakuten.co.jp')).toBe('Rakuten');
});

// ─── extractRootDomain ──────────────────────────────────────────────────────

suite('extractRootDomain');

test('simple .com', () => {
    expect(extractRootDomain('example.com')).toBe('example.com');
});

test('strips subdomain', () => {
    expect(extractRootDomain('mail.google.com')).toBe('google.com');
});

test('strips deep subdomain', () => {
    expect(extractRootDomain('a.b.c.example.com')).toBe('example.com');
});

test('multi-segment TLD .co.uk', () => {
    expect(extractRootDomain('google.co.uk')).toBe('google.co.uk');
});

test('subdomain + multi-segment TLD', () => {
    expect(extractRootDomain('docs.google.co.uk')).toBe('google.co.uk');
});

test('strips www prefix', () => {
    expect(extractRootDomain('www.github.com')).toBe('github.com');
});

test('null returns empty string', () => {
    expect(extractRootDomain(null)).toBe('');
});

test('.com.br TLD', () => {
    expect(extractRootDomain('app.empresa.com.br')).toBe('empresa.com.br');
});

test('two-segment hostname returns as-is', () => {
    expect(extractRootDomain('slack.com')).toBe('slack.com');
});

test('github.io (hosting suffix)', () => {
    expect(extractRootDomain('user.github.io')).toBe('user.github.io');
});

test('herokuapp.com (hosting suffix)', () => {
    expect(extractRootDomain('myapp.herokuapp.com')).toBe('myapp.herokuapp.com');
});

// ─── extractSubdomainLabel ──────────────────────────────────────────────────

suite('extractSubdomainLabel');

test('mail.google.com → mail', () => {
    expect(extractSubdomainLabel('mail.google.com')).toBe('mail');
});

test('company1.slack.com → company1', () => {
    expect(extractSubdomainLabel('company1.slack.com')).toBe('company1');
});

test('no subdomain → null', () => {
    expect(extractSubdomainLabel('google.com')).toBeNull();
});

test('nested subdomain — a.b.example.com → a.b', () => {
    expect(extractSubdomainLabel('a.b.example.com')).toBe('a.b');
});

test('www is stripped and treated as no subdomain', () => {
    expect(extractSubdomainLabel('www.google.com')).toBeNull();
});

test('null input → null', () => {
    expect(extractSubdomainLabel(null)).toBeNull();
});

test('multi-segment TLD — docs.google.co.uk → docs', () => {
    expect(extractSubdomainLabel('docs.google.co.uk')).toBe('docs');
});

// ─── extractBaseDomain ──────────────────────────────────────────────────────

suite('extractBaseDomain');

test('strips protocol and path', () => {
    expect(extractBaseDomain('https://www.youtube.com/watch?v=abc')).toBe('youtube.com');
});

test('strips www prefix', () => {
    expect(extractBaseDomain('https://www.example.com')).toBe('example.com');
});

test('preserves subdomain (non-www)', () => {
    expect(extractBaseDomain('https://mail.google.com/inbox')).toBe('mail.google.com');
});

test('handles port', () => {
    expect(extractBaseDomain('http://localhost:3000')).toBe('localhost');
});

test('null returns null', () => {
    expect(extractBaseDomain(null)).toBeNull();
});

test('invalid URL returns null', () => {
    expect(extractBaseDomain('not-a-url')).toBeNull();
});

// ─── findCommonTitlePrefix ──────────────────────────────────────────────────

suite('findCommonTitlePrefix');

test('Gmail tabs → Gmail', () => {
    const tabs = [
        tab('', 'Gmail - Inbox (3)'),
        tab('', 'Gmail - Sent Mail'),
        tab('', 'Gmail - Drafts'),
    ];
    expect(findCommonTitlePrefix(tabs)).toBe('Gmail');
});

test('Stripe Docs tabs → Stripe Docs', () => {
    const tabs = [
        tab('', 'Stripe Docs: API Reference'),
        tab('', 'Stripe Docs: Webhooks'),
    ];
    expect(findCommonTitlePrefix(tabs)).toBe('Stripe Docs');
});

test('Slack workspace tabs — common workspace name', () => {
    const tabs = [
        tab('', 'Acme Corp | #general - Slack'),
        tab('', 'Acme Corp | #random - Slack'),
    ];
    expect(findCommonTitlePrefix(tabs)).toBe('Acme Corp');
});

test('no common prefix → null', () => {
    const tabs = [
        tab('', 'Gmail - Inbox'),
        tab('', 'YouTube - Home'),
    ];
    expect(findCommonTitlePrefix(tabs)).toBeNull();
});

test('single tab → null (need 2+ to compare)', () => {
    const tabs = [tab('', 'Gmail - Inbox')];
    expect(findCommonTitlePrefix(tabs)).toBeNull();
});

test('short common prefix (< 3 chars) → null', () => {
    const tabs = [
        tab('', 'AB - Page 1'),
        tab('', 'AC - Page 2'),
    ];
    // Common prefix is "A" which is < 3 chars
    expect(findCommonTitlePrefix(tabs)).toBeNull();
});

test('all titles identical → returns the full title', () => {
    const tabs = [
        tab('', 'Dashboard - Overview'),
        tab('', 'Dashboard - Overview'),
    ];
    expect(findCommonTitlePrefix(tabs)).toBe('Dashboard - Overview');
});

test('trailing delimiter is stripped', () => {
    const tabs = [
        tab('', 'Project | Task A'),
        tab('', 'Project | Task B'),
    ];
    // "Project | Task" is the valid common prefix — both titles diverge after "Task "
    // and the space after is a clean word boundary.
    expect(findCommonTitlePrefix(tabs)).toBe('Project | Task');
});

test('Wikipedia language pages', () => {
    const tabs = [
        tab('', 'Wikipedia, the free encyclopedia'),
        tab('', 'Wikipedia – Die freie Enzyklopädie'),
    ];
    expect(findCommonTitlePrefix(tabs)).toBe('Wikipedia');
});

// ─── buildSubdomainName ─────────────────────────────────────────────────────

suite('buildSubdomainName');

test('uses title prefix when available', () => {
    const tabs = [
        tab('', 'Gmail - Inbox'),
        tab('', 'Gmail - Sent'),
    ];
    expect(buildSubdomainName('mail.google.com', tabs, 'Google')).toBe('Gmail');
});

test('falls back to Brand · Subdomain when no title prefix', () => {
    const tabs = [
        tab('', 'Payments overview'),
        tab('', 'Customer list'),
    ];
    expect(buildSubdomainName('admin.stripe.com', tabs, 'Stripe')).toBe('Stripe · Admin');
});

test('falls back to brand name when no subdomain', () => {
    const tabs = [
        tab('', 'Some page'),
    ];
    expect(buildSubdomainName('stripe.com', tabs, 'Stripe')).toBe('Stripe');
});

test('single tab — no title prefix, uses subdomain label', () => {
    const tabs = [tab('', 'Some Dashboard')];
    expect(buildSubdomainName('app.vercel.com', tabs, 'Vercel')).toBe('Vercel · App');
});

// ─── buildDistinctGroupName ─────────────────────────────────────────────────

suite('buildDistinctGroupName');

test('returns name when no conflict', () => {
    expect(buildDistinctGroupName('Google', [])).toBe('Google');
});

test('appends " 2" on first conflict', () => {
    expect(buildDistinctGroupName('Google', ['Google'])).toBe('Google 2');
});

test('appends " 3" when " 2" is also taken', () => {
    expect(buildDistinctGroupName('Google', ['Google', 'Google 2'])).toBe('Google 3');
});

test('case-insensitive conflict detection', () => {
    expect(buildDistinctGroupName('Google', ['google'])).toBe('Google 2');
});

// ─── domainPreferences ──────────────────────────────────────────────────────

suite('domainPreferences');

test('loadDomainPreferences returns empty object initially', () => {
    localStorage.clear();
    expect(JSON.stringify(loadDomainPreferences())).toBe('{}');
});

test('saveDomainPreference persists and returns updated prefs', () => {
    localStorage.clear();
    const result = saveDomainPreference('google.com', { split: true });
    expect(result['google.com'].split).toBe(true);
});

test('isDomainSplit returns true when split is set', () => {
    const prefs = { 'google.com': { split: true } };
    expect(isDomainSplit('google.com', prefs)).toBe(true);
});

test('isDomainSplit returns false when not set', () => {
    expect(isDomainSplit('slack.com', {})).toBe(false);
});

test('isDomainSplit returns false for null prefs', () => {
    expect(isDomainSplit('slack.com', null)).toBe(false);
});

test('saveDomainPreference merges with existing prefs', () => {
    localStorage.clear();
    saveDomainPreference('google.com', { split: true });
    saveDomainPreference('slack.com', { split: true });
    const prefs = loadDomainPreferences();
    expect(isDomainSplit('google.com', prefs)).toBe(true);
    expect(isDomainSplit('slack.com', prefs)).toBe(true);
});

test('saveDomainPreference can toggle split off', () => {
    localStorage.clear();
    saveDomainPreference('google.com', { split: true });
    saveDomainPreference('google.com', { split: false });
    const prefs = loadDomainPreferences();
    expect(isDomainSplit('google.com', prefs)).toBe(false);
});

// ─── buildDomainGroups — core grouping logic ────────────────────────────────

suite('buildDomainGroups — default (merged) mode');

test('tabs from same root domain are merged into one group', () => {
    resetTabs();
    const tabs = [
        tab('https://mail.google.com/inbox', 'Gmail - Inbox'),
        tab('https://docs.google.com/doc1', 'Google Docs - Doc 1'),
        tab('https://drive.google.com/files', 'Google Drive - My Files'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe('Google');
    expect(groups[0].tabs).toHaveLength(3);
    expect(groups[0].canSplit).toBe(true);
    expect(groups[0].subdomains.size).toBe(3);
});

test('different root domains create separate groups', () => {
    resetTabs();
    const tabs = [
        tab('https://github.com/user/repo', 'user/repo'),
        tab('https://mail.google.com', 'Gmail'),
        tab('https://youtube.com/watch', 'YouTube'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups).toHaveLength(3);
    const names = groups.map(g => g.displayName).sort();
    expect(names).toEqual(['GitHub', 'Google', 'YouTube']);
});

test('groups are sorted by descending tab count', () => {
    resetTabs();
    const tabs = [
        tab('https://github.com/a', 'A'),
        tab('https://google.com/1', '1'),
        tab('https://google.com/2', '2'),
        tab('https://google.com/3', '3'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups[0].displayName).toBe('Google');
    expect(groups[0].tabs).toHaveLength(3);
    expect(groups[1].displayName).toBe('GitHub');
    expect(groups[1].tabs).toHaveLength(1);
});

test('chrome:// tabs are excluded', () => {
    resetTabs();
    const tabs = [
        tab('chrome://extensions/', 'Extensions'),
        tab('chrome-extension://abc/popup.html', 'Popup'),
        tab('https://google.com', 'Google'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe('Google');
});

test('www is stripped — groups under same root domain', () => {
    resetTabs();
    const tabs = [
        tab('https://www.example.com/page1', 'Page 1'),
        tab('https://example.com/page2', 'Page 2'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups).toHaveLength(1);
    expect(groups[0].tabs).toHaveLength(2);
});

test('canSplit is false when only one hostname under root domain', () => {
    resetTabs();
    const tabs = [
        tab('https://github.com/a', 'A'),
        tab('https://github.com/b', 'B'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups[0].canSplit).toBe(false);
});

test('subdomainNames preview is populated when canSplit', () => {
    resetTabs();
    const tabs = [
        tab('https://mail.google.com/inbox', 'Gmail - Inbox'),
        tab('https://mail.google.com/sent', 'Gmail - Sent'),
        tab('https://docs.google.com/spreadsheets', 'Google Docs'),
        tab('https://docs.google.com/slides', 'Google Docs'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups[0].subdomainNames).toHaveLength(2);
    expect(groups[0].subdomainNames).toContain('Gmail');
    expect(groups[0].subdomainNames).toContain('Google Docs');
});

test('Slack workspaces — merged by default', () => {
    resetTabs();
    const tabs = [
        tab('https://acme.slack.com/messages', 'Acme Corp | #general - Slack'),
        tab('https://acme.slack.com/messages/random', 'Acme Corp | #random - Slack'),
        tab('https://widgets.slack.com/messages', 'WidgetCo | #dev - Slack'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe('Slack');
    expect(groups[0].canSplit).toBe(true);
});

test('multi-segment TLD — .co.uk tabs grouped correctly', () => {
    resetTabs();
    const tabs = [
        tab('https://news.bbc.co.uk/article1', 'BBC News'),
        tab('https://sport.bbc.co.uk/football', 'BBC Sport'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups).toHaveLength(1);
    expect(groups[0].rootDomain).toBe('bbc.co.uk');
    expect(groups[0].displayName).toBe('Bbc');
    expect(groups[0].canSplit).toBe(true);
});

// ─── buildDomainGroups — split mode ─────────────────────────────────────────

suite('buildDomainGroups — split mode');

test('split preference splits by hostname', () => {
    resetTabs();
    const tabs = [
        tab('https://mail.google.com/inbox', 'Gmail - Inbox'),
        tab('https://mail.google.com/sent', 'Gmail - Sent'),
        tab('https://docs.google.com/spreadsheets', 'Google Docs'),
        tab('https://docs.google.com/slides', 'Google Docs'),
        tab('https://drive.google.com/files', 'Google Drive - My Files'),
    ];
    const prefs = { 'google.com': { split: true } };
    const groups = buildDomainGroups(tabs, prefs);
    expect(groups).toHaveLength(3);

    const names = groups.map(g => g.displayName).sort();
    expect(names).toContain('Gmail');
    expect(names).toContain('Google Docs');
    expect(names).toContain('Google · Drive');
});

test('split groups have canSplit=false', () => {
    resetTabs();
    const tabs = [
        tab('https://mail.google.com', 'Gmail'),
        tab('https://docs.google.com', 'Docs'),
    ];
    const prefs = { 'google.com': { split: true } };
    const groups = buildDomainGroups(tabs, prefs);
    groups.forEach(g => expect(g.canSplit).toBe(false));
});

test('split groups all have same rootDomain', () => {
    resetTabs();
    const tabs = [
        tab('https://mail.google.com', 'Gmail'),
        tab('https://docs.google.com', 'Docs'),
    ];
    const prefs = { 'google.com': { split: true } };
    const groups = buildDomainGroups(tabs, prefs);
    groups.forEach(g => expect(g.rootDomain).toBe('google.com'));
});

test('split preference on one domain does not affect others', () => {
    resetTabs();
    const tabs = [
        tab('https://mail.google.com', 'Gmail'),
        tab('https://docs.google.com', 'Docs'),
        tab('https://acme.slack.com', 'Acme'),
        tab('https://widgets.slack.com', 'Widgets'),
    ];
    const prefs = { 'google.com': { split: true } };
    const groups = buildDomainGroups(tabs, prefs);

    const googleGroups = groups.filter(g => g.rootDomain === 'google.com');
    const slackGroups = groups.filter(g => g.rootDomain === 'slack.com');
    expect(googleGroups).toHaveLength(2); // split
    expect(slackGroups).toHaveLength(1);  // still merged
});

test('split preference ignored when only one subdomain', () => {
    resetTabs();
    const tabs = [
        tab('https://github.com/a', 'Repo A'),
        tab('https://github.com/b', 'Repo B'),
    ];
    const prefs = { 'github.com': { split: true } };
    const groups = buildDomainGroups(tabs, prefs);
    expect(groups).toHaveLength(1); // can't split — only one hostname
});

test('Slack workspaces — split extracts workspace names from titles', () => {
    resetTabs();
    const tabs = [
        tab('https://acme.slack.com/messages/general', 'Acme Corp | #general - Slack'),
        tab('https://acme.slack.com/messages/random', 'Acme Corp | #random - Slack'),
        tab('https://widgets.slack.com/messages/dev', 'WidgetCo | #dev - Slack'),
        tab('https://widgets.slack.com/messages/design', 'WidgetCo | #design - Slack'),
    ];
    const prefs = { 'slack.com': { split: true } };
    const groups = buildDomainGroups(tabs, prefs);
    expect(groups).toHaveLength(2);

    const names = groups.map(g => g.displayName).sort();
    expect(names).toContain('Acme Corp');
    expect(names).toContain('WidgetCo');
});

test('Stripe subdomains — merged keeps them as one cluster', () => {
    resetTabs();
    const tabs = [
        tab('https://dashboard.stripe.com/payments', 'Stripe Dashboard'),
        tab('https://docs.stripe.com/api', 'Stripe Docs: API Reference'),
        tab('https://docs.stripe.com/webhooks', 'Stripe Docs: Webhooks'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe('Stripe');
    expect(groups[0].tabs).toHaveLength(3);
});

test('_hostname temporary property is cleaned up', () => {
    resetTabs();
    const tabs = [
        tab('https://mail.google.com', 'Gmail'),
        tab('https://github.com', 'GitHub'),
    ];
    const groups = buildDomainGroups(tabs);
    for (const g of groups) {
        for (const t of g.tabs) {
            expect(t._hostname).toBe(undefined);
        }
    }
});

// ─── The bug the user reported — YouTube naming ─────────────────────────────

suite('Regression: YouTube naming bug');

test('app.youtube.com shows "YouTube" not "App"', () => {
    resetTabs();
    const tabs = [
        tab('https://app.youtube.com/watch?v=abc', 'Some Video - YouTube'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups[0].displayName).toBe('YouTube');
});

test('youtube.com shows "YouTube"', () => {
    resetTabs();
    const tabs = [tab('https://youtube.com', 'YouTube')];
    const groups = buildDomainGroups(tabs);
    expect(groups[0].displayName).toBe('YouTube');
});

test('m.youtube.com shows "YouTube"', () => {
    resetTabs();
    const tabs = [tab('https://m.youtube.com', 'YouTube')];
    const groups = buildDomainGroups(tabs);
    expect(groups[0].displayName).toBe('YouTube');
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

suite('Edge cases');

test('empty tab list returns empty array', () => {
    const groups = buildDomainGroups([]);
    expect(groups).toHaveLength(0);
});

test('tabs with no valid URL are skipped', () => {
    resetTabs();
    const tabs = [
        tab('not-a-url', 'Bad Tab'),
        tab('', 'Empty URL'),
        tab('https://google.com', 'Google'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups).toHaveLength(1);
});

test('tab with null URL is skipped', () => {
    resetTabs();
    const tabs = [{ id: 999, url: null, title: 'Null', windowId: 1 }];
    const groups = buildDomainGroups(tabs);
    expect(groups).toHaveLength(0);
});

test('favIconUrl is captured from first available tab', () => {
    resetTabs();
    const tabs = [
        tab('https://google.com/1', 'G1', null),
        tab('https://google.com/2', 'G2', 'https://google.com/favicon.ico'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups[0].favicon).toBe('https://google.com/favicon.ico');
});

test('hosting domains (github.io) — each user is a separate domain', () => {
    resetTabs();
    const tabs = [
        tab('https://user1.github.io/blog', 'User1 Blog'),
        tab('https://user2.github.io/docs', 'User2 Docs'),
    ];
    const groups = buildDomainGroups(tabs);
    // github.io is a public suffix, so user1.github.io and user2.github.io
    // are separate registrable domains
    expect(groups).toHaveLength(2);
});

test('herokuapp.com — each app is separate', () => {
    resetTabs();
    const tabs = [
        tab('https://myapp.herokuapp.com', 'My App'),
        tab('https://otherapp.herokuapp.com', 'Other App'),
    ];
    const groups = buildDomainGroups(tabs);
    expect(groups).toHaveLength(2);
});

test('mixed scenario — Google split + Slack merged + standalone', () => {
    resetTabs();
    const tabs = [
        tab('https://mail.google.com', 'Gmail - Inbox'),
        tab('https://mail.google.com/sent', 'Gmail - Sent'),
        tab('https://docs.google.com', 'Google Docs - Doc 1'),
        tab('https://acme.slack.com', 'Acme Corp | #general'),
        tab('https://widgets.slack.com', 'WidgetCo | #dev'),
        tab('https://github.com/user/repo', 'user/repo · GitHub'),
    ];
    const prefs = { 'google.com': { split: true } };
    const groups = buildDomainGroups(tabs, prefs);

    const googleGroups = groups.filter(g => g.rootDomain === 'google.com');
    const slackGroups = groups.filter(g => g.rootDomain === 'slack.com');
    const githubGroups = groups.filter(g => g.rootDomain === 'github.com');

    expect(googleGroups).toHaveLength(2);
    expect(slackGroups).toHaveLength(1);
    expect(githubGroups).toHaveLength(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`\x1b[1m  ${_pass + _fail} tests: \x1b[32m${_pass} passed\x1b[0m${_fail > 0 ? `, \x1b[31m${_fail} failed\x1b[0m` : ''}`);
console.log(`${'─'.repeat(60)}\n`);

process.exit(_fail > 0 ? 1 : 0);
