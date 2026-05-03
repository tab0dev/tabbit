// rabbit personality quips — one is picked at random per invocation.
// separated by feature context so each part of the app has its own flavor.

// picks a random quip from a named pool. returns '' if pool is empty/missing.
export function pickQuip(pool) {
  if (!pool || pool.length === 0) return '';
  return pool[Math.floor(Math.random() * pool.length)];
}

// triage action quips — shown in the monitor after keep/close/bookmark/group
export const TRIAGE_QUIPS = {
  keep: [
    'ooh, a keeper! *nose twitch*',
    'worth its weight in carrots.',
    'saved! good choice, friend.',
    'this tab stays. the bunny approves.',
    '*thump thump* nice pick!',
    'marking territory... done.',
  ],
  close: [
    'bye-bye! *hops away*',
    'poof. gone like a carrot dream.',
    'closed. the hutch is tidier now.',
    '*sniff* farewell, little tab.',
    'adios! more room to binky.',
    'tab closed. very clean. very nice.',
  ],
  bookmark: [
    'filed away like a prize carrot.',
    'bookmarked! bun remembers.',
    'safe in the warren now.',
    'stored! *ear wiggle*',
    'tucked in nice and cozy.',
    'noted! bun never forgets.',
  ],
  group: [
    'grouped! order restored.',
    'tabs in formation. bun approves.',
    'herded like tasty veggies.',
    'neatly bundled. *nose boop*',
    'squad assembled! hop to it.',
    'organized perfection. *thump*',
  ],
  undo: [
    'oops! undone. no judgment.',
    'taking that back... *hop hop*',
    'reversed! bun has your back.',
    'un-done, like a bad carrot stew.',
    'rolled back. fresh start!',
  ],
  back: [
    'stepping back... *cautious hop*',
    'rewind! bun is flexible.',
    'one hop back. no worries.',
  ],
  openPicker: [
    'choose wisely, friend.',
    '*sniff sniff* smells like options.',
    'picker time! bun is watching.',
  ],
};

// watch later quips — shown after batch youtube save
export const WATCH_LATER_QUIPS = {
  success: [
    'queue cleared! *happy blinks*',
    'saved for later. very responsible.',
    '*thump thump* all queued up!',
    'ah. much better.',
  ],
  partial: [
    'some made it. we tried our best.',
    'partial victory! *determined hop*',
    'not bad. we take it.',
    'a few slipped away... but most are safe!',
  ],
  failed: [
    'we are sorry. YouTube was being uncooperative.',
    '*sad ear droop* something went wrong.',
    'nothing saved. we suggest a retry.',
  ],
};
