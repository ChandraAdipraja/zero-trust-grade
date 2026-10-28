import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Shell } from "./components/Shell";
import { Login } from "./pages/Login";
import { Nilai } from "./pages/Nilai";
import { Transkrip } from "./pages/Transkrip";
import { Audit } from "./pages/Audit";

function HomeRedirect() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  const home = session.user.role === "admin" ? "/audit" : "/nilai";
  return <Navigate to={home} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Shell />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/nilai" element={<Nilai />} />
          <Route path="/transkrip" element={<Transkrip />} />
          <Route path="/audit" element={<Audit />} />
        </Route>
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </AuthProvider>
  );
}
