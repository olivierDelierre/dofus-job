import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RARITY_LABEL, type RarityResolver } from '../lib/rarity';
import type { GameData, Monster } from '../lib/types';

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

/** Icône d'objet avec une fiche détaillée (rareté, sources, monstres qui le lâchent) au survol. */
export function ItemIcon({ data, rarity, id, qty }: Props) {
  const item = data.items[id];
  const r = rarity.ofItem(id);
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 120);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      ref={anchor}
      className={`item r${r.rarity}`}
      tabIndex={0}
      aria-label={item?.name}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <img src={`/img/items/${item?.iconId}.png`} alt="" loading="lazy" />
      {qty !== undefined && <b>{fmt(qty)}</b>}
      {open && anchor.current && createPortal(<ItemCard data={data} rarity={rarity} id={id} anchor={anchor.current} />, document.body)}
    </span>
  );
}

function ItemCard({ data, rarity, id, anchor }: { data: GameData; rarity: RarityResolver; id: number; anchor: HTMLElement }) {
  const item = data.items[id];
  const r = rarity.ofItem(id);
  const card = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  // Place la fiche au-dessus de l'icône (ou en dessous s'il n'y a pas la place), sans sortir de l'écran.
  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const c = card.current!.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(margin, a.left + a.width / 2 - c.width / 2), window.innerWidth - c.width - margin);
    const below = a.top - c.height - margin < 0;
    const top = below ? Math.min(a.bottom + margin, window.innerHeight - c.height - margin) : a.top - c.height - margin;
    setPos({ left, top: Math.max(margin, top), below });
  }, [anchor]);

  if (!item) return null;
  // Monstres classiques d'abord (ce qu'on farme vraiment), puis boss, puis archimonstres et monstres de quête.
  const drops = [...(item.drops ?? [])].sort(
    ([ma, ra], [mb, rb]) => monsterRank(data.monsters[ma]) - monsterRank(data.monsters[mb]) || rb - ra,
  );
  const shown = drops.slice(0, MAX_DROPS);
  const maxRate = Math.max(...shown.map(([, rate]) => rate), 1);

  return (
    <div
      ref={card}
      className={`item-card r${r.rarity}`}
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      <header>
        <span className={`item r${r.rarity}`}>
          <img src={`/img/items/${item.iconId}.png`} alt="" />
        </span>
        <div>
          <div className="item-card-name">{item.name}</div>
          <div className="item-card-sub">
            Niv. {item.level}
            <span className={`tag r${r.rarity}`}>{RARITY_LABEL[r.rarity]}</span>
          </div>
        </div>
      </header>

      {/* La raison est déjà affichée par les pastilles de source quand elle se résume à l'une d'elles. */}
      {!SOURCE_REASONS.has(r.reason) && <div className="item-card-reason">{r.reason}</div>}

      {(item.harvestable || item.hasRecipe || item.tokenShop) && (
        <div className="item-card-sources">
          {item.harvestable && <span>Récoltable</span>}
          {item.hasRecipe && <span>Craftable</span>}
          {item.tokenShop && <span>Boutique à jetons</span>}
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
    </div>
  );
}

const monsterRank = (m: Monster | undefined) => (!m ? 3 : m.miniBoss || m.quest ? 2 : m.boss ? 1 : 0);

function DropRow({ monster, rate, max }: { monster: Monster | undefined; rate: number; max: number }) {
  const [broken, setBroken] = useState(false);
  if (!monster) return null;
  const badge = monster.miniBoss ? 'Archi' : monster.boss ? 'Boss' : monster.quest ? 'Quête' : null;
  return (
    <li className={badge ? `special ${badge.toLowerCase()}` : ''}>
      <span className="mob">
        {broken ? (
          <span className="mob-fallback">{monster.name[0]}</span>
        ) : (
          <img src={`/img/monsters/${monster.gfxId}.png`} alt="" loading="lazy" onError={() => setBroken(true)} />
        )}
      </span>
      <span className="drop-info">
        <span className="drop-name">
          <span>{monster.name}</span>
          {badge && <em>{badge}</em>}
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
