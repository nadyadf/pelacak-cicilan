
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../services/supabase";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatRupiah(value) {
  return rupiah.format(Number(value) || 0);
}

function formatTanggal(value) {
  if (!value) return "-";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function HutangPublik() {
  const { token } = useParams();

  const [hutang, setHutang] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let aktif = true;

    
    async function loadHutang() {
      setLoading(true);
      setError("");
      setHutang(null);

      const { data, error } = await supabase.functions.invoke(
        "get-public-debt",
        {
          body: { token },
        }
      );

      if (!aktif) return;

      if (error) {
        console.error("Gagal memuat hutang publik:", error);
        setError("Data hutang gagal dimuat. Silakan coba lagi.");
        setLoading(false);
        return;
      }

      if (!data || data.error) {
        setError(
          data?.error ||
            "Link hutang tidak ditemukan atau sudah tidak dibagikan."
        );
        setLoading(false);
        return;
      }

      setHutang(data);
      setLoading(false);
    }


    loadHutang();

    return () => {
      aktif = false;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="public-page">
        <div className="public-state">
          <div className="public-spinner" />
          <p className="muted">Memuat informasi hutang...</p>
        </div>
      </main>
    );
  }

  if (error || !hutang) {
    return (
      <main className="public-page">
        <header className="public-header">
          <div className="public-brand-icon">PC</div>
          <div>
            <h2>Pelacak Cicilan</h2>
            <p>Informasi hutang bersama</p>
          </div>
        </header>

        <section className="public-state public-error">
          <div className="public-state-icon">!</div>
          <h1>Informasi tidak tersedia</h1>
          <p className="muted">
            {error || "Data hutang tidak ditemukan."}
          </p>
        </section>

        <footer className="public-footer">
          Pelacak Cicilan
        </footer>
      </main>
    );
  }

  const cicilan = Array.isArray(hutang.installments)
    ? [...hutang.installments].sort((a, b) => {
        const dateA = new Date(a.paid_at).getTime();
        const dateB = new Date(b.paid_at).getTime();

        if (dateA !== dateB) return dateB - dateA;

        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      })
    : [];

  const totalHutang = Number(hutang.original_amount) || 0;
  const totalDibayar = cicilan.reduce(
    (total, item) => total + (Number(item.amount) || 0),
    0
  );

  const sisaHutang = Math.max(0, totalHutang - totalDibayar);
  const persentase =
    totalHutang > 0
      ? Math.min(100, (totalDibayar / totalHutang) * 100)
      : 0;

  const lunas = sisaHutang === 0;
  const namaHutang = hutang.name?.trim() || "Hutang pribadi";

  return (
    <main className="public-page">
      <header className="public-header">
        <div className="public-brand-icon">PC</div>

        <div className="public-brand-text">
          <h2>Pelacak Cicilan</h2>
          <p>Informasi hutang bersama</p>
        </div>

        <span className="public-status">
          {lunas ? "Lunas" : "Aktif"}
        </span>
      </header>

      <section className="public-summary panel">
        <p className="eyebrow">RINGKASAN HUTANG</p>

        <h1>{namaHutang}</h1>

        <p className="public-total-label">Total hutang</p>
        <p className="public-total">
          {formatRupiah(totalHutang)}
        </p>

        <div className="public-progress-section">
          <div className="public-progress-heading">
            <span>Progres pembayaran</span>
            <strong>{persentase.toFixed(1)}%</strong>
          </div>

          <div
            className="public-progress-track"
            role="progressbar"
            aria-label="Progres pembayaran hutang"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(persentase)}
          >
            <div
              className="public-progress-fill"
              style={{ width: `${persentase}%` }}
            />
          </div>
        </div>

        <div className="public-money-grid">
          <div className="public-money-card">
            <span className="public-money-dot paid" />
            <p>Sudah dibayar</p>
            <strong>{formatRupiah(totalDibayar)}</strong>
          </div>

          <div className="public-money-card">
            <span className="public-money-dot remaining" />
            <p>Sisa hutang</p>
            <strong>{formatRupiah(sisaHutang)}</strong>
          </div>
        </div>

        <div className={`public-settlement ${lunas ? "is-paid" : ""}`}>
          <span>{lunas ? "✓" : "↗"}</span>
          <p>
            {lunas
              ? "Hutang telah lunas."
              : "Informasi pembayaran diperbarui berdasarkan riwayat cicilan."}
          </p>
        </div>
      </section>

      <section className="public-history panel">
        <div className="public-history-heading">
          <div>
            <p className="eyebrow">CATATAN PEMBAYARAN</p>
            <h2>Riwayat cicilan</h2>
          </div>

          <span className="public-count">
            {cicilan.length} pembayaran
          </span>
        </div>

        {cicilan.length === 0 ? (
          <div className="public-empty">
            <div className="public-empty-icon">↗</div>
            <h3>Belum ada cicilan</h3>
            <p className="muted">
              Riwayat pembayaran akan muncul di sini setelah
              cicilan pertama dicatat.
            </p>
          </div>
        ) : (
          <div className="public-installment-list">
            {cicilan.map((item, index) => (
              <article
                className="public-installment"
                key={item.id}
              >
                <div className="public-installment-icon">
                  ✓
                </div>

                <div className="public-installment-content">
                  <div className="public-installment-top">
                    <h3>Pembayaran cicilan</h3>
                    <strong className="public-installment-amount">
                      {formatRupiah(item.amount)}
                    </strong>
                  </div>

                  <p className="public-installment-date">
                    {formatTanggal(item.paid_at)}
                  </p>

                  {item.note?.trim() && (
                    <p className="public-installment-note">
                      {item.note}
                    </p>
                  )}
                  
                  {item.proof_url && (
                    <a
                      className="public-proof-preview"
                      href={item.proof_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={item.proof_url}
                        alt={`Bukti transfer cicilan ${formatTanggal(item.paid_at)}`}
                        loading="lazy"
                      />
                      <span>
                        <span>Lihat bukti transfer</span>
                        <span aria-hidden="true">↗</span>
                      </span>
                    </a>
                  )}

                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="public-footer">
        <strong>Pelacak Cicilan</strong>
        <p>
          Made with care by <strong>Nadya D. Febita</strong>,
          to make tracking payments a little easier.
        </p>
        <p className="public-copyright">
          © {new Date().getFullYear()} Nadya D. Febita. All rights reserved.
        </p>
      </footer>

    </main>
  );
}
