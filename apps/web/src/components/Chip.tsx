const COL: Record<number, string> = {
  100: '#3b82f6', 500: '#d83a3a', 2000: '#27a35a', 10000: '#25252b',
  50000: '#7a3fd1', 100000: '#e07a1f', 500000: '#0f9fb5', 1000000: '#d4a017',
};

/** Chip kasino (CSS). Nilai 1.000.000 ke atas berwarna emas dengan tulisan gelap. */
export function Chip({ value, label, stack = 1 }: { value: number; label?: string; stack?: number }) {
  const color = COL[value] ?? '#8a5cf6';
  const gold = value >= 1_000_000;
  return (
    <span className={`chip-stack ${gold ? 'gold' : ''}`} style={{ ['--cc' as string]: color, ['--ct' as string]: gold ? '#3a2600' : '#fff' }}>
      {Array.from({ length: stack }, (_, i) => (
        <span key={i} className="chip" style={{ ['--k' as string]: i }}>
          {i === stack - 1 && <b>{label ?? ''}</b>}
        </span>
      ))}
    </span>
  );
}
