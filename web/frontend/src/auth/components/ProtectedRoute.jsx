import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function ProtectedRoute({
  children
}) {
  const {
    user,
    loading
  } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-emerald-50 text-emerald-800">
        Checking administrator session…
      </div>;
  }
  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace state={{
      from: location.pathname
    }} />;
  }
  return children;
}
