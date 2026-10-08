import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Lock, RefreshCw } from 'lucide-react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import AuthShell from '../components/AuthShell';
import FormAlert from '../components/FormAlert';
import { auth } from '../../services/firebase';
import { validatePassword } from '../validation';
export default function ResetPassword() {
  const [params] = useSearchParams();
  const code = params.get('oobCode');
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    let active = true;
    async function verify() {
      if (!auth || !code) {
        if (active) {
          setError('This password-reset link is invalid or expired.');
          setValidating(false);
        }
        return;
      }
      try {
        await verifyPasswordResetCode(auth, code);
        if (active) setValid(true);
      } catch {
        if (active) setError('This password-reset link is invalid or expired.');
      } finally {
        if (active) setValidating(false);
      }
    }
    verify();
    return () => {
      active = false;
    };
  }, [code]);
  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(auth, code, password);
      setSuccess('Password updated. You may now sign in.');
      setValid(false);
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError('Unable to reset the password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }
  return <AuthShell title="Choose a new password" subtitle="Create a strong password for your SoilSense account">
      <FormAlert>{error}</FormAlert>
      <FormAlert type="success">{success}</FormAlert>

      {validating && <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin text-lime-600" />
          Validating reset link…
        </div>}

      {valid && !validating && <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span className="form-label">New password</span>
            <span className="form-control-wrap">
              <Lock className="form-control-icon" />
              <input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value.replace(/\s/g, '').slice(0, 64))} className="form-control form-control-with-icon" placeholder="Create a new password" required />
            </span>
          </label>

          <label>
            <span className="form-label">Confirm new password</span>
            <span className="form-control-wrap">
              <CheckCircle2 className="form-control-icon" />
              <input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value.replace(/\s/g, '').slice(0, 64))} className="form-control form-control-with-icon" placeholder="Repeat your new password" required />
            </span>
          </label>

          <button type="submit" disabled={loading} className="primary-button">
            {loading ? 'Updating…' : 'Reset password'}
          </button>
        </form>}

      {!validating && !valid && <p className="auth-switch-text">
          <Link className="auth-link" to="/login">Go to login</Link>
        </p>}
    </AuthShell>;
}
