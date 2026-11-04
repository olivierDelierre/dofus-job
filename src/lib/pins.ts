import { useSyncExternalStore } from 'react';

/** Fiche d'objet épinglée : reste ouverte, déplaçable, fermable. */
export interface Pin {
  key: number;
  itemId: number;
  /** Position de l'icône au moment du clic, pour placer la fiche à côté. */
  anchor: { left: number; top: number; width: number; height: number };
  /** Position de la fiche, null tant qu'elle n'a pas été mesurée. */
  pos: { left: number; top: number } | null;
}

export const MAX_PINS = 3;

let pins: Pin[] = [];
let nextKey = 1;
const listeners = new Set<() => void>();

function set(next: Pin[]) {
  pins = next;
  listeners.forEach((l) => l());
}

export const pinStore = {
  /** Épingle la fiche d'un objet ; si elle l'est déjà, la passe au premier plan. Au-delà de 3, la plus ancienne se ferme. */
  pin(itemId: number, anchor: DOMRect) {
    const existing = pins.find((p) => p.itemId === itemId);
    if (existing) return pinStore.front(existing.key);
    const pin: Pin = {
      key: nextKey++,
      itemId,
      anchor: { left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height },
      pos: null,
    };
    set([...pins, pin].slice(-MAX_PINS));
  },
  /** L'ordre du tableau est l'ordre d'empilement : la dernière fiche est au-dessus. */
  front(key: number) {
    const p = pins.find((x) => x.key === key);
    if (!p || pins[pins.length - 1] === p) return;
    set([...pins.filter((x) => x !== p), p]);
  },
  move(key: number, pos: { left: number; top: number }) {
    set(pins.map((p) => (p.key === key ? { ...p, pos } : p)));
  },
  close(key: number) {
    set(pins.filter((p) => p.key !== key));
  },
  clear() {
    set([]);
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const usePins = () => useSyncExternalStore(subscribe, () => pins);
