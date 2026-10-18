
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function Akses() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw loginError;
      }

      navigate("/hutang", { replace: true });
    } catch (err) {
      if (err.message?.toLowerCase().includes("email not confirmed")) {
        setError(
          "Email belum dikonfirmasi. Periksa pengaturan konfirmasi email di Supabase."
        );
      } else if (
        err.status === 400 ||
        err.message?.toLowerCase().includes("invalid login credentials")
      ) {
        setError("Email atau kata sandi tidak sesuai.");
      } else {
        setError(
          "Login gagal. Periksa koneksi internet dan coba lagi."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="access-page">
      <div className="access-card">
        <div className="login-brand">
          <span className="brand-icon">◈</span>
          <span>
            Pelacak<span className="brand-accent">Cicilan</span>
          </span>
        </div>

        <p className="access-eyebrow">RUANG PRIBADI</p>

        <h1 className="access-title">
          Selamat datang kembali
        </h1>

        <p className="access-description">
          Masuk untuk melihat dan mengelola catatan cicilanmu.
        </p>

        <form className="access-form" onSubmit={handleSubmit}>
          <div className="access-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email akun pemilik"
              autoComplete="username"
              required
            />
          </div>

          <div className="access-field">
            <label htmlFor="password">Kata sandi</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Masukkan kata sandi"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="access-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="access-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>

        <p className="access-footnote">
          Catatan cicilan pribadi, dalam satu tempat.
        </p>
      </div>
    </div>
  );
}
