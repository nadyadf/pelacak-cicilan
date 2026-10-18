import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../services/supabase";

const BUCKET = "bukti-transfer";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTanggal(value) {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getFileExtension(file) {
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensions[file.type] ?? null;
}

export default function DetailHutang() {
  const { id } = useParams();

  const [debt, setDebt] = useState(null);
  const [installments, setInstallments] = useState([]);

  // Form tambah cicilan
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(getToday);
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState("");

  // Form edit cicilan
  const [editingInstallment, setEditingInstallment] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editPaidAt, setEditPaidAt] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editProofFile, setEditProofFile] = useState(null);
  const [editProofPreview, setEditProofPreview] = useState("");

  const [proofUrls, setProofUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [sharingBusy, setSharingBusy] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: debtData, error: debtError } = await supabase
        .from("debts")
        .select("id, name, original_amount, created_at, share_token, is_shared")
        .eq("id", id)
        .single();

      if (debtError) throw debtError;

      const { data: installmentData, error: installmentError } =
        await supabase
          .from("installments")
          .select("id, amount, paid_at, note, proof_path, created_at")
          .eq("debt_id", id)
          .order("paid_at", { ascending: false })
          .order("created_at", { ascending: false });

      if (installmentError) throw installmentError;

      setDebt(debtData);
      setInstallments(installmentData ?? []);

      const paths = (installmentData ?? [])
        .map((item) => item.proof_path)
        .filter(Boolean);

      const urlEntries = await Promise.all(
        [...new Set(paths)].map(async (path) => {
          const { data, error: urlError } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(path, 300);

          if (urlError) {
            console.error("Gagal membuat URL bukti:", urlError);
            return [path, null];
          }

          return [path, data.signedUrl];
        })
      );

      setProofUrls(Object.fromEntries(urlEntries));
    } catch (err) {
      console.error("Gagal memuat detail hutang:", err);
      setError("Detail hutang gagal dimuat. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!proofFile) {
      setProofPreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(proofFile);
    setProofPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [proofFile]);

  useEffect(() => {
    if (!editProofFile) {
      setEditProofPreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(editProofFile);
    setEditProofPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [editProofFile]);

  const totalDibayar = installments.reduce(
    (total, item) => total + Number(item.amount),
    0
  );

  const totalHutang = Number(debt?.original_amount ?? 0);
  const sisaHutang = Math.max(0, totalHutang - totalDibayar);
  const progres =
    totalHutang > 0
      ? Math.min(100, (totalDibayar / totalHutang) * 100)
      : 0;

  function validateProofFile(file) {
    if (!file) return true;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Bukti harus berupa gambar JPG, PNG, atau WebP.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Ukuran gambar maksimal 2 MB.");
      return false;
    }

    return true;
  }

  function handleProofChange(event) {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setProofFile(null);

    if (!file) return;

    if (!validateProofFile(file)) {
      event.target.value = "";
      return;
    }

    setProofFile(file);
  }

  function startEditing(item) {
    setError("");
    setSuccess("");
    setEditingInstallment(item);
    setEditAmount(String(item.amount));
    setEditPaidAt(item.paid_at);
    setEditNote(item.note ?? "");
    setEditProofFile(null);
  }

  function cancelEditing() {
    setEditingInstallment(null);
    setEditAmount("");
    setEditPaidAt("");
    setEditNote("");
    setEditProofFile(null);
    setEditProofPreview("");
    const input = document.getElementById("edit-installment-proof");
    if (input) input.value = "";
  }

  function handleEditProofChange(event) {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setEditProofFile(null);

    if (!file) return;

    if (!validateProofFile(file)) {
      event.target.value = "";
      return;
    }

    setEditProofFile(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const nominal = Number(amount);

    if (!Number.isFinite(nominal) || nominal <= 0) {
      setError("Nominal cicilan harus lebih dari Rp0.");
      return;
    }

    if (nominal > sisaHutang) {
      setError(
        `Nominal cicilan melebihi sisa hutang ${formatRupiah(sisaHutang)}.`
      );
      return;
    }

    if (!paidAt) {
      setError("Tanggal pembayaran wajib diisi.");
      return;
    }

    setSaving(true);
    let uploadedPath = null;

    try {
      if (proofFile) {
        const extension = getFileExtension(proofFile);
        const filePath = `${id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, proofFile, {
            contentType: proofFile.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;
        uploadedPath = filePath;
      }

      const { error: insertError } = await supabase
        .from("installments")
        .insert({
          debt_id: id,
          amount: nominal,
          paid_at: paidAt,
          note: note.trim() || null,
          proof_path: uploadedPath,
        });

      if (insertError) throw insertError;

      setAmount("");
      setPaidAt(getToday());
      setNote("");
      setProofFile(null);

      const input = document.getElementById("installment-proof");
      if (input) input.value = "";

      setSuccess("Cicilan berhasil disimpan.");
      await loadDetail();
    } catch (err) {
      console.error("Gagal menyimpan cicilan:", err);

      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from(BUCKET)
          .remove([uploadedPath]);

        if (cleanupError) {
          console.error("Gagal membersihkan file:", cleanupError);
        }
      }

      if (
        err.message?.includes(
          "Total cicilan tidak boleh melebihi total hutang"
        )
      ) {
        setError("Total cicilan tidak boleh melebihi total hutang.");
      } else if (err.message?.includes("row-level security")) {
        setError("Akses ditolak. Periksa kebijakan akses Storage di Supabase.");
      } else {
        setError("Cicilan gagal disimpan. Periksa koneksi dan izin penyimpanan.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    if (!editingInstallment) return;

    setError("");
    setSuccess("");

    const nominal = Number(editAmount);

    if (!Number.isFinite(nominal) || nominal <= 0) {
      setError("Nominal cicilan harus lebih dari Rp0.");
      return;
    }

    if (!editPaidAt) {
      setError("Tanggal pembayaran wajib diisi.");
      return;
    }

    setSaving(true);
    let uploadedPath = null;
    const oldProofPath = editingInstallment.proof_path;

    try {
      let nextProofPath = oldProofPath;

      // Bukti lama tetap dipakai jika pengguna tidak memilih file baru.
      if (editProofFile) {
        const extension = getFileExtension(editProofFile);
        if (!extension) {
          throw new Error("Format bukti transfer tidak didukung.");
        }

        uploadedPath = `${id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(uploadedPath, editProofFile, {
            contentType: editProofFile.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;
        nextProofPath = uploadedPath;
      }

      const { error: updateError } = await supabase
        .from("installments")
        .update({
          amount: nominal,
          paid_at: editPaidAt,
          note: editNote.trim() || null,
          proof_path: nextProofPath,
        })
        .eq("id", editingInstallment.id)
        .eq("debt_id", id);

      if (updateError) throw updateError;

      // Hapus bukti lama hanya setelah data berhasil diperbarui.
      let oldProofRemovalFailed = false;
      if (editProofFile && oldProofPath) {
        const { error: removeError } = await supabase.storage
          .from(BUCKET)
          .remove([oldProofPath]);

        if (removeError) {
          oldProofRemovalFailed = true;
          console.error("Gagal menghapus bukti lama:", removeError);
        }
      }

      cancelEditing();
      setSuccess(
        oldProofRemovalFailed
          ? "Cicilan berhasil diperbarui, tetapi bukti lama gagal dihapus dari Storage."
          : "Cicilan berhasil diperbarui."
      );
      await loadDetail();
    } catch (err) {
      console.error("Gagal memperbarui cicilan:", err);

      // Jika upload bukti baru berhasil tetapi update database gagal,
      // hapus file baru agar tidak menjadi file yatim.
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from(BUCKET)
          .remove([uploadedPath]);

        if (cleanupError) {
          console.error("Gagal membersihkan bukti baru:", cleanupError);
        }
      }

      if (
        err.message?.includes(
          "Total cicilan tidak boleh melebihi total hutang"
        )
      ) {
        setError("Total cicilan tidak boleh melebihi total hutang.");
      } else if (err.message?.includes("row-level security")) {
        setError("Akses ditolak. Periksa kebijakan akses tabel dan Storage.");
      } else {
        setError(err.message || "Cicilan gagal diperbarui. Silakan coba lagi.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(installment) {
    const confirmed = window.confirm(
      `Hapus cicilan ${formatRupiah(installment.amount)} tanggal ${formatTanggal(installment.paid_at)}?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingId(installment.id);

    try {
      const { error: deleteError } = await supabase
        .from("installments")
        .delete()
        .eq("id", installment.id)
        .eq("debt_id", id);

      if (deleteError) throw deleteError;

      if (installment.proof_path) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET)
          .remove([installment.proof_path]);

        if (storageError) {
          console.error("Gagal menghapus file bukti:", storageError);
          setError(
            "Cicilan terhapus, tetapi file bukti gagal dihapus. Periksa Storage."
          );
        }
      }

      setSuccess("Cicilan berhasil dihapus.");
      if (editingInstallment?.id === installment.id) cancelEditing();
      await loadDetail();
    } catch (err) {
      console.error("Gagal menghapus cicilan:", err);
      setError("Cicilan gagal dihapus. Silakan coba lagi.");
    } finally {
      setDeletingId(null);
    }
  }

  
  async function handleToggleSharing(nextValue) {
    setError("");
    setSuccess("");
    setSharingBusy(true);

    try {
      const { data, error: updateError } = await supabase
        .from("debts")
        .update({ is_shared: nextValue })
        .eq("id", id)
        .select("id, share_token, is_shared")
        .single();

      if (updateError) throw updateError;

      setDebt((current) => ({
        ...current,
        ...data,
      }));

      setSuccess(
        nextValue
          ? "Link publik berhasil diaktifkan."
          : "Link publik berhasil dinonaktifkan."
      );
    } catch (err) {
      console.error("Gagal mengubah akses berbagi:", err);
      setError(
        "Status berbagi gagal diperbarui. Silakan coba lagi."
      );
    } finally {
      setSharingBusy(false);
    }
  }

  async function handleCopyShareLink() {
    if (!debt?.share_token || !debt?.is_shared) return;

    const shareUrl =
      `${window.location.origin}/b/${debt.share_token}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setError("");
      setSuccess("Link hutang berhasil disalin.");
    } catch (err) {
      console.error("Gagal menyalin link:", err);
      setError(
        "Link belum berhasil disalin. Salin URL pada kolom yang tersedia secara manual."
      );
    }
  }


  if (loading) {
    return <p className="detail-message">Memuat detail hutang...</p>;
  }

  if (!debt) {
    return (
      <section className="detail-page">
        <p className="detail-error">
          {error || "Data hutang tidak ditemukan."}
        </p>
        <Link to="/hutang" className="back-link">
          ← Kembali ke daftar hutang
        </Link>
      </section>
    );
  }

  return (
    <section className="detail-page">
      <Link to="/hutang" className="back-link">
        ← Kembali ke daftar hutang
      </Link>

      <header className="detail-heading">
        <p className="detail-eyebrow">DETAIL PEMBAYARAN</p>
        <h1>{debt.name || "Hutang tanpa nama"}</h1>
        <p>Catatan pembayaran dan perkembangan cicilanmu.</p>
      </header>

      <section className="detail-summary">
        <article className="detail-summary-card">
          <span>Total hutang</span>
          <strong>{formatRupiah(totalHutang)}</strong>
        </article>
        <article className="detail-summary-card">
          <span>Total dibayar</span>
          <strong>{formatRupiah(totalDibayar)}</strong>
        </article>
        <article className="detail-summary-card">
          <span>Sisa hutang</span>
          <strong>{formatRupiah(sisaHutang)}</strong>
        </article>
      </section>

      <section className="progress-card">
        <div className="progress-heading">
          <h2>Progres pembayaran</h2>
          <strong>{progres.toFixed(1)}%</strong>
        </div>
        <div
          className="debt-progress-track"
          role="progressbar"
          aria-label="Progres pembayaran hutang"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progres)}
        >
          <div
            className="debt-progress-fill"
            style={{ width: `${progres}%` }}
          />
        </div>
        <p>
          {sisaHutang <= 0
            ? "Hutang ini sudah lunas."
            : `Masih perlu membayar ${formatRupiah(sisaHutang)}.`}
        </p>
      </section>

      <section className="sharing-card">
        <div className="sharing-heading">
          <div>
            <p className="sharing-eyebrow">AKSES PUBLIK</p>
            <h2>Bagikan informasi hutang</h2>
            <p>
              Berikan link ini kepada penerima agar mereka bisa
              melihat ringkasan dan riwayat cicilan tanpa login.
            </p>
          </div>

          <span
            className={`sharing-status ${
              debt.is_shared ? "sharing-active" : ""
            }`}
          >
            {debt.is_shared ? "Aktif" : "Nonaktif"}
          </span>
        </div>

        {debt.is_shared ? (
          <>
            <div className="sharing-link-field">
              <input
                type="text"
                aria-label="Link publik hutang"
                value={`${window.location.origin}/b/${debt.share_token}`}
                readOnly
                onFocus={(event) => event.target.select()}
              />

              <button
                type="button"
                className="sharing-copy-button"
                onClick={handleCopyShareLink}
                disabled={sharingBusy}
              >
                Salin link
              </button>
            </div>

            <p className="sharing-hint">
              Siapa pun yang memiliki link ini dapat melihat
              informasi hutang yang dibagikan.
            </p>

            <button
              type="button"
              className="sharing-disable-button"
              onClick={() => handleToggleSharing(false)}
              disabled={sharingBusy}
            >
              {sharingBusy
                ? "Memproses..."
                : "Nonaktifkan berbagi"}
            </button>
          </>
        ) : (
          <>
            <p className="sharing-hint">
              Link belum bisa diakses. Aktifkan berbagi jika
              kamu ingin penerima melihat informasi hutang ini.
            </p>

            <button
              type="button"
              className="sharing-enable-button"
              onClick={() => handleToggleSharing(true)}
              disabled={sharingBusy}
            >
              {sharingBusy
                ? "Memproses..."
                : "Aktifkan Berbagi"}
            </button>
          </>
        )}
      </section>


      {error && <p className="detail-error" role="alert">{error}</p>}
      {success && <p className="detail-success" role="status">{success}</p>}

      {sisaHutang > 0 && (
        <section className="installment-form-card">
          <h2>Tambah cicilan</h2>
          <p>Catat pembayaran yang sudah kamu lakukan.</p>

          <form className="debt-form" onSubmit={handleSubmit}>
            <div className="debt-field">
              <label htmlFor="installment-amount">Nominal cicilan (Rp)</label>
              <input
                id="installment-amount"
                type="number"
                min="0.01"
                max={sisaHutang}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Contoh: 500000"
                required
              />
              <span className="field-hint">
                Maksimal {formatRupiah(sisaHutang)}
              </span>
            </div>

            <div className="debt-field">
              <label htmlFor="installment-date">Tanggal pembayaran</label>
              <input
                id="installment-date"
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
                required
              />
            </div>

            <div className="debt-field">
              <label htmlFor="installment-note">Catatan (opsional)</label>
              <textarea
                id="installment-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Contoh: Cicilan bulan Oktober"
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="debt-field">
              <label htmlFor="installment-proof">Bukti transfer (opsional)</label>
              <input
                id="installment-proof"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleProofChange}
              />
              <span className="field-hint">JPG, PNG, atau WebP. Maksimal 2 MB.</span>
              {proofPreview && (
                <img
                  className="proof-preview"
                  src={proofPreview}
                  alt="Pratinjau bukti transfer"
                />
              )}
            </div>

            <button className="debt-submit" type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan cicilan"}
            </button>
          </form>
        </section>
      )}

      <section className="installment-history">
        <div className="debt-list-heading">
          <h2>Riwayat cicilan</h2>
          <span>{installments.length} pembayaran</span>
        </div>

        {installments.length === 0 ? (
          <div className="dashboard-empty">
            <h3>Belum ada cicilan</h3>
            <p>Pembayaran yang kamu catat akan muncul di sini.</p>
          </div>
        ) : (
          <div className="installment-list">
            {installments.map((item) => (
              <article className="installment-item" key={item.id}>
                <div className="installment-info">
                  <strong>{formatRupiah(item.amount)}</strong>
                  <span>{formatTanggal(item.paid_at)}</span>
                  {item.note && <p>{item.note}</p>}

                  {item.proof_path && (
                    proofUrls[item.proof_path] ? (
                      <a
                        className="proof-link"
                        href={proofUrls[item.proof_path]}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          className="proof-thumbnail"
                          src={proofUrls[item.proof_path]}
                          alt="Bukti transfer cicilan"
                        />
                        <span>Lihat bukti transfer</span>
                      </a>
                    ) : (
                      <span className="field-hint">
                        Bukti tidak dapat dimuat. Coba muat ulang halaman.
                      </span>
                    )
                  )}
                </div>

                <div className="installment-actions">
                  <button
                    className="installment-edit"
                    type="button"
                    disabled={saving || deletingId === item.id}
                    onClick={() =>
                      editingInstallment?.id === item.id
                        ? cancelEditing()
                        : startEditing(item)
                    }
                  >
                    {editingInstallment?.id === item.id ? "Tutup Edit" : "Edit"}
                  </button>
                  <button
                    className="installment-delete"
                    type="button"
                    disabled={saving || deletingId === item.id}
                    onClick={() => handleDelete(item)}
                  >
                    {deletingId === item.id ? "Menghapus..." : "Hapus"}
                  </button>
                </div>

                {editingInstallment?.id === item.id && (
                  <form
                    className="debt-form installment-edit-form"
                    onSubmit={handleEditSubmit}
                  >
                    <h3>Edit cicilan</h3>

                    <div className="debt-field">
                      <label htmlFor={`edit-amount-${item.id}`}>Nominal cicilan (Rp)</label>
                      <input
                        id={`edit-amount-${item.id}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={editAmount}
                        onChange={(event) => setEditAmount(event.target.value)}
                        required
                      />
                      <span className="field-hint">
                        Nominal akan divalidasi agar total cicilan tidak melebihi hutang.
                      </span>
                    </div>

                    <div className="debt-field">
                      <label htmlFor={`edit-date-${item.id}`}>Tanggal pembayaran</label>
                      <input
                        id={`edit-date-${item.id}`}
                        type="date"
                        value={editPaidAt}
                        onChange={(event) => setEditPaidAt(event.target.value)}
                        required
                      />
                    </div>

                    <div className="debt-field">
                      <label htmlFor={`edit-note-${item.id}`}>Catatan (opsional)</label>
                      <textarea
                        id={`edit-note-${item.id}`}
                        value={editNote}
                        onChange={(event) => setEditNote(event.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Catatan pembayaran"
                      />
                    </div>

                    <div className="debt-field">
                      <label htmlFor="edit-installment-proof">Ganti bukti transfer (opsional)</label>
                      <input
                        id="edit-installment-proof"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleEditProofChange}
                      />
                      <span className="field-hint">
                        {item.proof_path
                          ? "Bukti lama tetap digunakan jika tidak memilih gambar baru."
                          : "Belum ada bukti transfer. Kamu bisa menambahkan gambar."}{" "}
                        JPG, PNG, atau WebP; maksimal 2 MB.
                      </span>

                      {!editProofPreview &&
                        item.proof_path &&
                        proofUrls[item.proof_path] && (
                          <img
                            className="proof-preview"
                            src={proofUrls[item.proof_path]}
                            alt="Bukti transfer saat ini"
                          />
                        )}

                      {editProofPreview && (
                        <img
                          className="proof-preview"
                          src={editProofPreview}
                          alt="Pratinjau bukti transfer baru"
                        />
                      )}
                    </div>

                    <div className="installment-edit-buttons">
                      <button
                        className="debt-submit"
                        type="submit"
                        disabled={saving}
                      >
                        {saving ? "Menyimpan..." : "Simpan perubahan"}
                      </button>
                      <button
                        className="installment-cancel"
                        type="button"
                        disabled={saving}
                        onClick={cancelEditing}
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
