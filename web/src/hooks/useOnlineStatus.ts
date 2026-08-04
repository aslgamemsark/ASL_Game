import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

/** True while the browser reports network connectivity. `navigator.onLine`/`online`/`offline` had
 *  no consumer anywhere in the app (audit, 2026-07-31): the PWA shell is precached, so a user who
 *  goes offline sees the app load perfectly and then every network feature (Leaderboard, Friends,
 *  progress sync, ...) fail as a generic, indistinguishable error — nothing tells them *why*, and
 *  the lesson/practice/story loop genuinely still works (its models are `CacheFirst`), which a
 *  generic error obscures too. `useSyncExternalStore`, not a raw `useState` + `useEffect` pair: the
 *  same infinite-update-loop trap `pwaInstall.ts`'s comment already documents applies here too if
 *  `getSnapshot` isn't referentially trivial — `navigator.onLine` itself is a primitive read, so
 *  there's no snapshot-caching to get wrong, unlike that module's derived-object case. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
