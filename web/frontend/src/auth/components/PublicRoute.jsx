import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function PublicRoute({
  children
}) {
  const {
    user,
    loading
  } = useAuth();
  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-emerald-50 text-emerald-800">
        Checking administrator session…
      </div>;
  }
  if (!user) return children;
  return <Navigate to="/admin/dashboard" replace />;
}
