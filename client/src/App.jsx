import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";

const VERDICT_CONFIG = {
  HOAKS: {
    label: "Hoaks", emoji: "⚠️",
    badgeBg: "#FEF2F2", badgeColor: "#991B1B", badgeBorder: "#FECACA",
    fillColor: "#EF4444", statBg: "#FEF2F2", statColor: "#991B1B",
  },
  DISINFORMASI: {
    label: "Disinformasi", emoji: "🟠",
    badgeBg: "#FFFBEB", badgeColor: "#92400E", badgeBorder: "#FDE68A",
    fillColor: "#F59E0B", statBg: "#FFFBEB", statColor: "#92400E",
  },
  PERLU_VERIFIKASI: {
    label: "Perlu Verifikasi", emoji: "🔵",
    badgeBg: "#EFF6FF", badgeColor: "#1E40AF", badgeBorder: "#BFDBFE",
    fillColor: "#3B82F6", statBg: "#EFF6FF", statColor: "#1E40AF",
  },
  KEMUNGKINAN_BENAR: {
    label: "Kemungkinan Benar", emoji: "✅",
    badgeBg: "#F0FDF4", badgeColor: "#166534", badgeBorder: "#BBF7D0",
    fillColor: "#22C55E", statBg: "#F0FDF4", statColor: "#166534",
  },
  TIDAK_DAPAT_DINILAI: {
    label: "Tidak Dapat Dinilai", emoji: "➖",
    badgeBg: "#F8FAFC", badgeColor: "#475569", badgeBorder: "#CBD5E1",
    fillColor: "#94A3B8", statBg: "#F8FAFC", statColor: "#475569",
  },
};

function isURL(str) {
  try { new URL(str); return true; } catch { return false; }
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

function VerdictBadge({ verdict }) {
  const cfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.TIDAK_DAPAT_DINILAI;
  return (
    <span className="verdict-badge" style={{ background: cfg.badgeBg, color: cfg.badgeColor, borderColor: cfg.badgeBorder }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function ProgressBar({ value, verdict }) {
  const cfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.TIDAK_DAPAT_DINILAI;
  return (
    <div className="progress-wrap">
      <div className="progress-label">
        <span>Tingkat keyakinan</span>
        <span>{value}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${value}%`, background: cfg.fillColor }} />
      </div>
    </div>
  );
}

function TagList({ items, variant }) {
  if (!items?.length) return null;
  return (
    <div className="tag-list">
      {items.map((t, i) => <span key={i} className={`tag tag-${variant}`}>{t}</span>)}
    </div>
  );
}

function DetailCard({ title, icon, full, children }) {
  return (
    <div className={`detail-card${full ? " full" : ""}`}>
      <div className="detail-title">{icon} {title}</div>
      {children}
    </div>
  );
}

export default function App() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const resultRef = useRef(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } catch (_) {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, [fetchHistory, fetchStats]);

  async function analyze() {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      let contentToAnalyze = text;
      let inputLabel = text;

      if (isURL(text.trim())) {
        const scrapeRes = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: text.trim() }),
        });
        const scrapeData = await scrapeRes.json();
        if (!scrapeRes.ok) throw new Error(scrapeData.error || "Gagal mengambil konten URL");
        contentToAnalyze = scrapeData.content;
        inputLabel = scrapeData.title || text;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: contentToAnalyze, input_text: inputLabel }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan server");

      setResult(data);
      await fetchHistory();
      await fetchStats();
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e.message || "Gagal menganalisis konten. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const conf = result ? Math.min(100, Math.max(0, Math.round(result.confidence || 0))) : 0;

  const STAT_KEYS = ["HOAKS", "DISINFORMASI", "PERLU_VERIFIKASI", "KEMUNGKINAN_BENAR", "TIDAK_DAPAT_DINILAI"];

  return (
    <div className="page">
      <header className="header">
        <div className="eyebrow">🛡️ Pendeteksi Hoaks AI</div>
        <h1>CekHoaks</h1>
        <p>Tempel teks berita, postingan media sosial, atau URL yang ingin kamu periksa.</p>
      </header>

      <div className="main-grid">
        {/* Kolom Kiri */}
        <div className="col-left">
          {/* Input */}
          <div className="card input-card">
            <label htmlFor="content" className="input-label">Teks atau URL yang ingin diperiksa</label>
            <textarea
              id="content"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyze(); }}
              placeholder={"Tempel teks berita, postingan, klaim, atau URL di sini...\n\nContoh: 'VIRAL!! Pemerintah resmi hapus subsidi BBM mulai bulan depan!'"}
            />
            <div className="input-footer">
              <span className="char-count">{text.length} karakter · Ctrl+Enter untuk analisis</span>
              <button className="btn-analyze" onClick={analyze} disabled={loading || !text.trim()}>
                {loading ? "⏳ Menganalisis..." : "🔍 Analisis"}
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="loading-box">
              <div className="spinner" />
              Menganalisis konten, mohon tunggu...
            </div>
          )}

          {/* Error */}
          {error && <div className="error-box">⚠️ {error}</div>}

          {/* Output / Result */}
          {result && (
            <div className="result-section" ref={resultRef}>
              <div className="card verdict-card">
                <div className="verdict-row">
                  <VerdictBadge verdict={result.verdict} />
                  <ProgressBar value={conf} verdict={result.verdict} />
                </div>
                <p className="ringkasan">{result.ringkasan}</p>
              </div>

              <div className="detail-grid">
                <DetailCard title="Klaim Utama" icon="💬" full>
                  <p className="detail-body">{result.klaim_utama || "—"}</p>
                </DetailCard>

                {result.tanda_bahaya?.length > 0 && (
                  <DetailCard title="Tanda Bahaya" icon="⚠️">
                    <TagList items={result.tanda_bahaya} variant="danger" />
                  </DetailCard>
                )}

                {result.sinyal_positif?.length > 0 && (
                  <DetailCard title="Sinyal Positif" icon="✅">
                    <TagList items={result.sinyal_positif} variant="success" />
                  </DetailCard>
                )}

                <DetailCard title="Penalaran" icon="🧠" full>
                  <p className="detail-body">{result.penalaran || "—"}</p>
                </DetailCard>

                <DetailCard title="Rekomendasi" icon="📋" full>
                  <p className="detail-body">{result.rekomendasi || "—"}</p>
                </DetailCard>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="empty-output card">
              <span className="empty-icon">🔍</span>
              <p>Hasil analisis akan muncul di sini</p>
            </div>
          )}
        </div>

        {/* Kolom Kanan */}
        <div className="col-right">
          {/* Statistik */}
          <div className="card stats-card">
            <div className="panel-title">📊 Statistik Deteksi</div>
            {stats ? (
              <>
                <div className="stats-total">
                  <span className="stats-total-num">{stats.total}</span>
                  <span className="stats-total-label">Total Analisis</span>
                </div>
                <div className="stats-list">
                  {STAT_KEYS.map(key => {
                    const cfg = VERDICT_CONFIG[key];
                    const count = stats[key] || 0;
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    return (
                      <div key={key} className="stat-item">
                        <div className="stat-item-top">
                          <span className="stat-label" style={{ color: cfg.statColor }}>
                            {cfg.emoji} {cfg.label}
                          </span>
                          <span className="stat-count">{count}</span>
                        </div>
                        <div className="stat-bar-track">
                          <div className="stat-bar-fill" style={{ width: `${pct}%`, background: cfg.fillColor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="panel-empty">Memuat statistik...</div>
            )}
          </div>

          {/* Histori */}
          <div className="card history-card">
            <div className="panel-title">🕒 Histori Deteksi</div>
            {history.length === 0 ? (
              <div className="panel-empty">Belum ada histori deteksi.</div>
            ) : (
              <div className="history-list">
                {history.map((item) => {
                  const cfg = VERDICT_CONFIG[item.verdict] || VERDICT_CONFIG.TIDAK_DAPAT_DINILAI;
                  return (
                    <div key={item.id} className="history-item">
                      <div className="history-item-top">
                        <span className="history-badge" style={{ background: cfg.badgeBg, color: cfg.badgeColor, borderColor: cfg.badgeBorder }}>
                          {cfg.emoji} {cfg.label}
                        </span>
                        <span className="history-time">{timeAgo(item.created_at)}</span>
                      </div>
                      <p className="history-text">{item.input_text?.slice(0, 100)}{item.input_text?.length > 100 ? "..." : ""}</p>
                      <div className="history-conf">
                        <div className="history-conf-bar" style={{ width: `${item.confidence}%`, background: cfg.fillColor }} />
                        <span>{item.confidence}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="footer">
        CekHoaks tidak menggantikan pengecekan fakta profesional. Selalu verifikasi dari sumber terpercaya.
      </footer>
    </div>
  );
}