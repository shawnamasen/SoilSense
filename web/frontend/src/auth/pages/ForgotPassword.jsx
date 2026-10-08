import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import AuthShell from '../components/AuthShell';
import FormAlert from '../components/FormAlert';
import { auth } from '../../services/firebase';
import { EMAIL_REGEX, normalizeEmail } from '../validation';
const GENERIC_SUCCESS = 'If an account exists for that email, a password-reset link will be sent.';
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!auth) {
      setError('Firebase Authentication is not configured.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
    } catch (err) {
      console.error('Password reset request:', err?.code || err?.message);
    } finally {
      setSuccess(GENERIC_SUCCESS);
      setLoading(false);
    }
  }
  return <AuthShell title="Reset your password" subtitle="We’ll help you securely regain access to SoilSense">
      <FormAlert>{error}</FormAlert>
      <FormAlert type="success">{success}</FormAlert>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span className="form-label">Email address</span>
          <span className="form-control-wrap">
            <Mail className="form-control-icon" />
            <input type="email" value={email} onChange={event => setEmail(event.target.value.toLowerCase().replace(/\s/g, '').slice(0, 100))} autoComplete="email" className="form-control form-control-with-icon" placeholder="Enter your email" disabled={loading} required />
          </span>
        </label>

        <button type="submit" disabled={loading} className="primary-button">
          <Send /> {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="auth-switch-text">
        <Link className="auth-link inline-flex items-center gap-1" to="/login">
          <ArrowLeft /> Back to login
        </Link>
      </p>
    </AuthShell>;
}
