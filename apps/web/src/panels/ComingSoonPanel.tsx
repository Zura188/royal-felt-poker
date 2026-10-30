const INFO: Record<string, { title: string; stage: string; text: string }> = {
  vip: { title: 'VIP', stage: 'Tahap 6', text: 'VIP hanya memberi kosmetik dan kenyamanan, tanpa keuntungan kompetitif.' },
  'create-room': { title: 'Buat Room', stage: 'Tahap 5', text: 'Room publik dan privat (kode) butuh server multiplayer yang belum dibuat.' },
  'join-room': { title: 'Main Online', stage: 'Tahap 5', text: 'Bermain dengan teman butuh server multiplayer yang belum dibuat. Mode online belum tersedia.' },
  disconnected: { title: 'Koneksi Terputus', stage: 'Tahap 5', text: 'Halaman ini muncul saat koneksi ke server online terputus. Mode offline tidak butuh koneksi.' },
};
export const comingSoonTitle = (k: string) => INFO[k]?.title ?? 'Segera';

export function ComingSoonPanel({ kind }: { kind: string }) {
  const i = INFO[kind] ?? INFO['join-room'];
  return (
    <div className="soon-box">
      <span className="tag-soon">BELUM TERSEDIA · {i.stage}</span>
      <p>{i.text}</p>
    </div>
  );
}
