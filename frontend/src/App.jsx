import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute.jsx';
import Dashboard from './pages/Dashboard.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

export default function App() {
  return (
  <Routes>
    {/* Always accessible */}
    <Route path="/" element={<HomePage />} />
    <Route path="/home" element={<HomePage />} />

    {/* Only accessible when logged out */}
    <Route element={<PublicOnlyRoute />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>

    {/* Only accessible when logged in */}
    <Route element={<ProtectedRoute />}>
      <Route path="/tasks" element={<Dashboard />} />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
  );
}
