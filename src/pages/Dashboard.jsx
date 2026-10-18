
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabase";

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export default function Dashboard() {
  const [debts, setDebts] = useState([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDebts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("debts")
        .select(`
          id,
          name,
          original_amount,
          created_at,
          installments ( amount )
        `)
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;

      setDebts(data ?? []);
    } catch (err) {
      console.error("Gagal mengambil data hutang:", err);
      setError("Data hutang gagal dimuat. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const originalAmount = Number(amount);

    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      setError("Nominal hutang harus lebih dari Rp0.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setError("Sesi login tidak ditemukan. Silakan login kembali.");
        return;
      }

      const { error: insertError } = await supabase
        .from("debts")
        .insert({
          owner_id: user.id,
          name: name.trim() || null,
          original_amount: originalAmount,
        });

      if (insertError) throw insertError;

      setName("");
      setAmount("");
      setSuccess("Hutang berhasil ditambahkan.");

      await loadDebts();
    } catch (err) {
      console.error("Gagal menambahkan hutang:", err);
      setError("Hutang gagal ditambahkan. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const totalHutang = debts.reduce(
    (total, debt) => total + Number(debt.original_amount),
    0
  );

  const totalDibayar = debts.reduce(
    (total, debt) =>
      total +
      (debt.installments ?? []).reduce(
        (sum, installment) => sum + Number(installment.amount),
        0
      ),
    0
  );

  return (
    <section className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">RUANG PRIBADI</p>
          <h1>Daftar Hutang</h1>
          <p className="dashboard-description">
            Pantau cicilan dan catat setiap pembayaranmu.
          </p>
        </div>
      </div>

      <div className="debt-summary">
        <article className="summary-card">
          <span>Total hutang</span>
          <strong>{formatRupiah(totalHutang)}</strong>
        </article>

        <article className="summary-card">
          <span>Total dibayar</span>
          <strong>{formatRupiah(totalDibayar)}</strong>
        </article>

        <article className="summary-card">
          <span>Sisa hutang</span>
          <strong>{formatRupiah(totalHutang - totalDibayar)}</strong>
        </article>
      </div>

      <section className="debt-form-card">
        <h2>Tambah hutang</h2>
        <p>Catat hutang baru untuk mulai memantau cicilannya.</p>

        <form className="debt-form" onSubmit={handleSubmit}>
          <div className="debt-field">
            <label htmlFor="debt-name">Nama hutang (opsional)</label>
            <input
              id="debt-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Hutang laptop"
              maxLength={100}
            />
          </div>

          <div className="debt-field">
            <label htmlFor="debt-amount">Total hutang (Rp)</label>
            <input
              id="debt-amount"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Contoh: 5000000"
              required
            />
          </div>

          {error && (
            <p className="dashboard-error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="dashboard-success" role="status">
              {success}
            </p>
          )}

          <button
            className="debt-submit"
            type="submit"
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "Simpan hutang"}
          </button>
        </form>
      </section>

      <section className="debt-list-section">
        <div className="debt-list-heading">
          <h2>Hutang saya</h2>
          <span>{debts.length} catatan</span>
        </div>

        {loading ? (
          <p className="dashboard-message">Memuat data hutang...</p>
        ) : error && debts.length === 0 ? (
          <div className="dashboard-empty">
            <p>{error}</p>
            <button type="button" onClick={loadDebts}>
              Coba lagi
            </button>
          </div>
        ) : debts.length === 0 ? (
          <div className="dashboard-empty">
            <h3>Belum ada catatan hutang</h3>
            <p>Tambahkan hutang pertamamu melalui formulir di atas.</p>
          </div>
        ) : (
          <div className="debt-list">
            {debts.map((debt) => {
              const paid = (debt.installments ?? []).reduce(
                (sum, installment) =>
                  sum + Number(installment.amount),
                0
              );

              const original = Number(debt.original_amount);
              const remaining = original - paid;
              const progress = Math.min(
                100,
                Math.max(0, (paid / original) * 100)
              );

              return (
                <Link
                  to={`/hutang/${debt.id}`}
                  className="debt-card"
                  key={debt.id}
                >
                  <div className="debt-card-top">
                    <div>
                      <h3>{debt.name || "Hutang tanpa nama"}</h3>
                      <p>Total {formatRupiah(original)}</p>
                    </div>

                    <span
                      className={
                        remaining <= 0
                          ? "debt-status debt-status-paid"
                          : "debt-status"
                      }
                    >
                      {remaining <= 0 ? "Lunas" : "Berjalan"}
                    </span>
                  </div>

                  <div className="debt-progress-track">
                    <div
                      className="debt-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="debt-card-bottom">
                    <span>{progress.toFixed(0)}% terbayar</span>
                    <span>Sisa {formatRupiah(remaining)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
