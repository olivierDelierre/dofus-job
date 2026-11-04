import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { RARITY_LABEL, RARITY_TONE, type RarityResolver } from '../lib/rarity';
import type { GameData, Monster } from '../lib/types';
import { pinStore, usePins, type Pin } from '../lib/pins';

const MAX_DROPS = 8;
const SOURCE_REASONS = new Set(['Récoltable', 'Craftable', 'Boutique à jetons']);
const fmt = (n: number) => n.toLocaleString('fr-FR');
const fmtRate = (r: number) => `${r.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

interface Props {
  data: GameData;
  rarity: RarityResolver;
  id: number;
  qty?: number;
}

const MARGIN = 8;

/** Place une fiche au-dessus de l'icône (ou en dessous s'il n'y a pas la place), sans sortir de l'écran. */
function placeNear(a: { left: number; top: number; width: number; height: number }, c: DOMRect) {
  const left = Math.min(Math.max(MARGIN, a.left + a.width / 2 - c.width / 2), window.innerWidth - c.width - MARGIN);
  const below = a.top - c.height - MARGIN < 0;
  const top = below ? Math.min(a.top + a.height + MARGIN, window.innerHeight - c.height - MARGIN) : a.top - c.height - MARGIN;
  return { left, top: Math.max(MARGIN, Math.min(top, window.innerHeight - c.height - MARGIN)) };
}

/**
 * Icône d'objet. Au survol : fiche détaillée (rareté, sources, monstres qui le lâchent).
 * Au clic : la fiche est épinglée (reste ouverte, déplaçable, 3 au plus).
 */
export function ItemIcon({ data, rarity, id, qty }: Props) {
  const item = data.items[id];
  const r = rarity.ofItem(id);
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pinned = usePins().some((p) => p.itemId === id);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 120);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };
  const pin = () => {
    hide();
    if (anchor.current) pinStore.pin(id, anchor.current.getBoundingClientRect());
  };

  return (
    <span
      ref={anchor}
      className={`item r${r.rarity} ${pinned ? 'is-pinned' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={item?.name}
      aria-pressed={pinned}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={pin}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pin();
        }
      }}
    >
      <img src={`/img/items/${item?.iconId}.png`} alt="" loading="lazy" />
      {qty !== undefined && <b>{fmt(qty)}</b>}
      {open && !pinned && anchor.current && createPortal(<HoverCard data={data} rarity={rarity} id={id} anchor={anchor.current} />, document.body)}
    </span>
  );
}

function HoverCard({ data, rarity, id, anchor }: { data: GameData; rarity: RarityResolver; id: number; anchor: HTMLElement }) {
  const card = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => setPos(placeNear(anchor.getBoundingClientRect(), card.current!.getBoundingClientRect())), [anchor]);

  return (
    <div
      ref={card}
      className="item-card br-glass"
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      <ItemCardBody data={data} rarity={rarity} id={id} />
      <div className="item-card-hint">Clic pour garder la fiche ouverte</div>
    </div>
  );
}

/** Fiches épinglées, rendues une seule fois au niveau de l'app. */
export function PinnedCards({ data, rarity }: { data: GameData; rarity: RarityResolver }) {
  const pins = usePins();
  return createPortal(
    <>
      {pins.map((p, i) => (
        <PinnedCard key={p.key} pin={p} z={i} data={data} rarity={rarity} />
      ))}
    </>,
    document.body,
  );
}

function PinnedCard({ pin, z, data, rarity }: { pin: Pin; z: number; data: GameData; rarity: RarityResolver }) {
  const card = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const name = data.items[pin.itemId]?.name ?? 'Objet';

  useLayoutEffect(() => {
    if (!pin.pos) pinStore.move(pin.key, placeNear(pin.anchor, card.current!.getBoundingClientRect()));
  }, [pin]);

  // On peut lâcher la fiche n'importe où, mais au moins 64px restent visibles pour pouvoir la reprendre.
  const clamp = (left: number, top: number) => {
    const w = card.current!.offsetWidth;
    return {
      left: Math.min(Math.max(left, 64 - w), window.innerWidth - 64),
      top: Math.min(Math.max(top, 0), window.innerHeight - 64),
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    pinStore.front(pin.key);
    if (e.button !== 0 || (e.target as Element).closest('button')) return;
    const rect = card.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, id: e.pointerId };
    card.current!.setPointerCapture(e.pointerId);
    setDragging(true);
    e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    pinStore.move(pin.key, clamp(e.clientX - d.dx, e.clientY - d.dy));
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      ref={card}
      className={`item-card item-card--pinned br-glass ${dragging ? 'is-dragging' : ''}`}
      role="dialog"
      aria-label={`Fiche : ${name}`}
      style={{ zIndex: 60 + z, ...(pin.pos ? pin.pos : { left: 0, top: 0, visibility: 'hidden' }) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(e) => e.key === 'Escape' && pinStore.close(pin.key)}
    >
      <button className="icon-btn item-card-close" aria-label={`Fermer la fiche ${name}`} onClick={() => pinStore.close(pin.key)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <ItemCardBody data={data} rarity={rarity} id={pin.itemId} />
    </div>
  );
}

function ItemCardBody({ data, rarity, id }: { data: GameData; rarity: RarityResolver; id: number }) {
  const item = data.items[id];
  const r = rarity.ofItem(id);
  if (!item) return null;
  // Monstres classiques d'abord (ce qu'on farme vraiment), puis boss, puis archimonstres et monstres de quête.
  const drops = [...(item.drops ?? [])].sort(([ma, ra], [mb, rb]) => monsterRank(data.monsters[ma]) - monsterRank(data.monsters[mb]) || rb - ra);
  const shown = drops.slice(0, MAX_DROPS);
  const maxRate = Math.max(...shown.map(([, rate]) => rate), 1);

  return (
    <>
      <header>
        <span className={`item r${r.rarity}`}>
          <img src={`/img/items/${item.iconId}.png`} alt="" draggable={false} />
        </span>
        <div>
          <div className="item-card-name">{item.name}</div>
          <div className="item-card-sub">
            Niv. {item.level}
            <span className={`br-badge br-badge--${RARITY_TONE[r.rarity]}`}>{RARITY_LABEL[r.rarity]}</span>
          </div>
        </div>
      </header>

      {/* La raison est déjà affichée par les pastilles de source quand elle se résume à l'une d'elles. */}
      {!SOURCE_REASONS.has(r.reason) && <div className="item-card-reason">{r.reason}</div>}

      {(item.harvestable || item.hasRecipe || item.tokenShop) && (
        <div className="item-card-sources">
          {item.harvestable && <span className="br-badge br-badge--brand">Récoltable</span>}
          {item.hasRecipe && <span className="br-badge br-badge--brand">Craftable</span>}
          {item.tokenShop && <span className="br-badge br-badge--brand">Boutique à jetons</span>}
        </div>
      )}

      {shown.length > 0 ? (
        <>
          <div className="item-card-title">
            Lâché par {drops.length} monstre{drops.length > 1 ? 's' : ''}
          </div>
          <ul className="drops">
            {shown.map(([mid, rate]) => (
              <DropRow key={mid} monster={data.monsters[mid]} rate={rate} max={maxRate} />
            ))}
          </ul>
          {drops.length > MAX_DROPS && <div className="item-card-more">+ {drops.length - MAX_DROPS} autres monstres</div>}
        </>
      ) : (
        !item.harvestable && !item.hasRecipe && <div className="item-card-more">Aucun monstre ne le lâche.</div>
      )}
    </>
  );
}

const monsterRank = (m: Monster | undefined) => (!m ? 3 : m.miniBoss || m.quest ? 2 : m.boss ? 1 : 0);

function DropRow({ monster, rate, max }: { monster: Monster | undefined; rate: number; max: number }) {
  const [broken, setBroken] = useState(false);
  if (!monster) return null;
  const badge = monster.miniBoss ? 'Archi' : monster.boss ? 'Boss' : monster.quest ? 'Quête' : null;
  return (
    <li>
      <span className="mob">
        {broken ? (
          <span className="mob-fallback">{monster.name[0]}</span>
        ) : (
          <img src={`/img/monsters/${monster.gfxId}.png`} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} />
        )}
      </span>
      <span className="drop-info">
        <span className="drop-name">
          <span>{monster.name}</span>
          {badge && <span className={`br-badge ${badge === 'Boss' ? 'br-badge--warning' : 'br-badge--danger'}`}>{badge}</span>}
        </span>
        <span className="drop-meta">Niv. {monster.level}</span>
      </span>
      <span className="drop-rate">
        <strong>{fmtRate(rate)}</strong>
        <span className="rate-bar">
          <i style={{ width: `${Math.max(4, (rate / max) * 100)}%` }} />
        </span>
      </span>
    </li>
  );
}
