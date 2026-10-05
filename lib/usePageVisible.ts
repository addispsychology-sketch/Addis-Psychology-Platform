'use client';
import { useSyncExternalStore } from 'react';

let visible = true;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const publish = (next: boolean) => {
  if (visible === next) return;
  visible = next;
  listeners.forEach(listener => listener());
};
const changed = () => {
  clearTimeout(timer);
  if (document.visibilityState === 'visible') publish(true);
  // Brief app switches keep their connection; abandoned tabs release it.
  else timer = setTimeout(() => publish(false), 30000);
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', changed);
    changed();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      document.removeEventListener('visibilitychange', changed);
      clearTimeout(timer);
      visible = true;
    }
  };
};
export function usePageVisible() {
  return useSyncExternalStore(subscribe, () => visible, () => true);
}
