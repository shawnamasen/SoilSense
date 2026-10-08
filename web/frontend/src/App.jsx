import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/context/AuthContext';
import ProtectedRoute from './auth/components/ProtectedRoute';
import PublicRoute from './auth/components/PublicRoute';
import Login from './auth/pages/Login';
import Signup from './auth/pages/Signup';
import ForgotPassword from './auth/pages/ForgotPassword';
import ResetPassword from './auth/pages/ResetPassword';
import LandingPage from './landing/LandingPage';
import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/pages/AdminDashboard';
import Farmers from './admin/pages/Farmers';
import Devices from './admin/pages/Devices';
import Support from './admin/pages/Support';
import ReportsAnalytics from './admin/pages/ReportsAnalytics';
import ActivityLog from './admin/pages/ActivityLog';
import AdminSettings from './admin/pages/AdminSettings';
import { AdminPreferencesProvider } from './admin/context/AdminPreferencesContext';

function AdminShell() {
  return <ProtectedRoute>
    <AdminPreferencesProvider>
      <AdminLayout />
    </AdminPreferencesProvider>
  </ProtectedRoute>;
}

export default function App() {
  return <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />

        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="farmers" element={<Farmers />} />
          <Route path="devices" element={<Devices />} />
          <Route path="support" element={<Support />} />
          <Route path="reports" element={<ReportsAnalytics />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="business" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>;
}
