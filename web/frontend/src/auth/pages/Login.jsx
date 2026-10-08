import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import FormAlert from '../components/FormAlert';
import GoogleIcon from '../components/GoogleIcon';
import { useAuth } from '../context/AuthContext';
import { EMAIL_REGEX, normalizeEmail } from '../validation';
function friendlyLoginError(error) {
  if (error?.code === 'auth/email-not-verified') {
    return 'Verify your email before signing in. Check your inbox for the verification link.';
  }
  if (error?.code === 'auth/too-many-requests') {
    return 'Too many sign-in attempts. Wait a few minutes before trying again.';
  }
  if (error?.code === 'auth/popup-blocked') {
    return 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.';
  }
  if (error?.code === 'auth/popup-closed-by-user') {
    return 'Google sign-in was cancelled before it finished.';
  }
  if (error?.code === 'auth/firebase-not-configured') {
    return 'Firebase is not configured. Check frontend/.env.';
  }
  return 'Unable to sign in with those credentials.';
}
export default function Login() {
  const {
    loginWithEmail,
    loginWithGoogle
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestedDestination = location.state?.from || '/admin/dashboard';
  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_REGEX.test(normalizedEmail) || !password) {
      setError('Enter a valid email address and password.');
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(normalizedEmail, password);
      navigate(requestedDestination, {
        replace: true
      });
    } catch (err) {
      console.error('Sign-in failed:', err?.code || err?.message);
      setError(friendlyLoginError(err));
    } finally {
      setLoading(false);
    }
  }
  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate(requestedDestination, {
        replace: true
      });
    } catch (err) {
      console.error('Google sign-in failed:', err?.code || err?.message);
      setError(friendlyLoginError(err));
    } finally {
      setLoading(false);
    }
  }
  return <AuthShell variant="login" title="Welcome back" subtitle={<>Sign in to continue to <strong>SoilSense</strong></>}>
      <FormAlert>{error}</FormAlert>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label>
          <span className="form-label">Email address</span>
          <span className="form-control-wrap">
            <Mail className="form-control-icon" />
            <input type="email" inputMode="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={100} disabled={loading} className="form-control form-control-with-icon" placeholder="Enter your email" required />
          </span>
        </label>

        <label>
          <span className="form-label">Password</span>
          <span className="form-control-wrap">
            <Lock className="form-control-icon" />
            <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value.slice(0, 128))} disabled={loading} className="form-control form-control-with-icon form-control-with-action" placeholder="Enter your password" required />
            <button type="button" onClick={() => setShowPassword(current => !current)} className="input-action" aria-label={showPassword ? 'Hide password' : 'Show password'} disabled={loading}>
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </span>
        </label>

        <div className="auth-forgot-row">
          <Link className="auth-link" to="/forgot-password">Forgot password?</Link>
        </div>

        <button type="submit" disabled={loading} className="primary-button">
          <LogIn /> {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="auth-divider">or continue with</div>

      <button type="button" onClick={handleGoogle} disabled={loading} className="google-button">
        <GoogleIcon /> Continue with Google
      </button>

      <p className="auth-switch-text">
        Don&apos;t have an account? <Link className="auth-link" to="/signup">Sign up</Link>
      </p>
    </AuthShell>;
}
