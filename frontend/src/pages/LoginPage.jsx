import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginRequest } from '../api/authApi.js';
import { useAuth } from '../hooks/useAuth.js';
import { getErrorMessage, getFieldErrors } from '../utils/errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const setField = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;

    const problems = {};
    if (!EMAIL_PATTERN.test(values.email.trim())) problems.email = 'Enter a valid email address';
    if (!values.password) problems.password = 'Password is required';
    setErrors(problems);
    setFormError('');
    if (Object.keys(problems).length > 0) return;

    inFlight.current = true;
    setSubmitting(true);
    try {
      const session = await loginRequest({ email: values.email.trim(), password: values.password });
      login(session);
      navigate(location.state?.from?.pathname ?? '/tasks', { replace: true });
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setFormError(getErrorMessage(err, 'Login failed'));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate aria-labelledby="login-title">
        <h1 id="login-title" className="auth-title">
          Welcome Back
        </h1>
        <p className="auth-subtext">Log in to manage your tasks and stay productive!</p>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={setField('email')}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
          />
          {errors.email && (
            <p className="field-error" id="login-email-error">
              {errors.email}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={setField('password')}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
          />
          {errors.password && (
            <p className="field-error" id="login-password-error">
              {errors.password}
            </p>
          )}
        </div>

        <button type="submit" className="auth-button" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Login'}
        </button>

        <p className="auth-switch">
          Don’t have an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </main>
  );
}
