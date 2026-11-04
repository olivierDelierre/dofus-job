import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  className?: string;
}

/** Brume Tabs : contrôle segmenté dont le fond blanc glisse vers l'entrée choisie. */
export function Tabs<T extends string>({ items, value, onChange, label, className }: Props<T>) {
  const idx = Math.max(
    0,
    items.findIndex((it) => it.value === value),
  );

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + items.length) % items.length;
    onChange(items[j].value);
    e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role=tab]')[j]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={`br-tabs ${className ?? ''}`} style={{ '--n': items.length, '--i': idx } as CSSProperties}>
      <span className="br-tabs__thumb" aria-hidden />
      {items.map((it, i) => {
        const on = i === idx;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={`br-tabs__tab ${on ? 'is-active' : ''}`}
            onClick={() => onChange(it.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
