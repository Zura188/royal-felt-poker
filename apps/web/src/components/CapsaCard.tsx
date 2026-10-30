import { isRed, type Card } from '@rfp/shared';

interface Props {
  card?: Card;
  size: 'hand' | 'mid' | 'mini';
  selected?: boolean;
  dim?: boolean;
  /** urutan kartu di tangan (dipakai pemilihan dengan geser jari) */
  index?: number;
  /** hanya dipakai kartu di tangan; klik dari papan ketik/pembaca layar (detail = 0) */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** penanda kartu di meja (data-tk): dipakai animasi kartu meluncur dari tangan */
  tk?: string;
  style?: React.CSSProperties;
}

export function CapsaCard({ card, size, selected, dim, index, onClick, tk, style }: Props) {
  const cls = ['cc', `sz-${size}`, card ? (isRed(card) ? 'red' : '') : 'back', selected ? 'sel' : '', dim ? 'dim' : '', onClick ? 'tap' : '']
    .filter(Boolean)
    .join(' ');
  if (!card) return <div className={cls} style={style} aria-hidden="true" />;
  const label = `${card.r}${card.s}`;
  const inner = (
    <>
      <span className="r">{card.r}</span>
      <span className="s">{card.s}</span>
      <span className="big" aria-hidden="true">{card.s}</span>
      <span className="r2" aria-hidden="true">{card.r}<i>{card.s}</i></span>
    </>
  );
  // Kartu di tangan selalu <button>: jika elemennya berganti (button <-> div) saat giliran berubah,
  // React membuat ulang kartu dan animasi bagi kartu terulang (tangan terlihat berkedip).
  if (size === 'hand') {
    return (
      <button
        type="button"
        className={cls}
        style={style}
        onClick={onClick}
        disabled={!onClick}
        aria-label={label}
        aria-pressed={!!selected}
        data-ci={index}
        data-id={label}
      >
        {inner}
      </button>
    );
  }
  return <div className={cls} style={style} aria-label={label} data-tk={tk}>{inner}</div>;
}
