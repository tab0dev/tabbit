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

// auto tab grouper quips
export const GROUPER_QUIPS = {
  save: [
    'rules noted. bun will keep watch.',
    'settings locked in. *nose boop*',
    'grouper ready to herd!',
  ],
  apply: [
    'all herded up! *happy hop*',
    'tabs sorted into their pens.',
    'grouped and ready to go.',
  ],
};

// auto tab closer quips
export const CLOSER_QUIPS = {
  save: [
    'closer rules saved. bun is ruthless.',
    'settings updated. preparing to munch.',
    'got it. old tabs, beware!',
  ],
  clear: [
    'graveyard emptied. *dusts paws*',
    'all clean. back to zero.',
    'swept away like old hay.',
  ],
  restore: [
    'back from the dead! *spooky ear wiggle*',
    'tab revived. a second chance!',
    'pulled it right out of the hat.',
  ],
};

// auto smusher quips
export const SMUSHER_QUIPS = {
  save: [
    'smusher rules saved. bun hates clutter.',
    'settings locked. no duplicates allowed!',
    'got it. double tabs get the thump.',
  ],
  smush: [
    'duplicates smushed! *stomp*',
    'clutter cleared. so much space!',
    'flattened the extras. you are welcome.',
  ],
};

// auto sorter quips
export const SORTER_QUIPS = {
  save: [
    'sorter settings saved. bun loves order.',
    'rules updated. everything in its place.',
    'got it. preparing to alphabetize.',
  ],
  sortNow: [
    'sorted! perfection achieved.',
    'tabs ordered. *satisfying thump*',
    'all lined up nicely.',
  ],
};

// tab group wizard quips
export const WIZARD_QUIPS = {
  group: [
    'magic applied! *wand wave*',
    'groups created. bun is a wizard.',
    'ta-da! tabs are organized.',
  ],
};

// close old tabs quips
export const CLOSE_OLD_QUIPS = {
  close: [
    'stale tabs tossed! *munch*',
    'old hay cleared out.',
    'swept away the cobwebs.',
  ],
};
