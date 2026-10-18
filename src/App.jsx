
import { Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./routes/ProtectedRoute";
import Akses from "./pages/Akses";
import Dashboard from "./pages/Dashboard";
import DetailHutang from "./pages/DetailHutang";
import HutangPublik from "./pages/HutangPublik";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Akses />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/hutang" element={<Dashboard />} />
          <Route
            path="/hutang/:id"
            element={<DetailHutang />}
          />
        </Route>
      </Route>

      <Route
        path="/b/:token"
        element={<HutangPublik />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
