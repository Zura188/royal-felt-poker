export function LoadingScreen() {
  return (
    <div className="loading" role="status" aria-label="Memuat">
      <div className="logo static">
        <span className="logo-top">ROYAL FELT</span>
        <h1>CAPSA<br />BANTING</h1>
      </div>
      <div className="loading-bar"><span /></div>
      <small>Menyiapkan meja…</small>
    </div>
  );
}
