import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerRequest } from '../api/authApi.js';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { getErrorMessage, getFieldErrors } from '../utils/errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const setField = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;

    const problems = {};
    if (!values.name.trim()) problems.name = 'Name is required';
    if (!EMAIL_PATTERN.test(values.email.trim())) problems.email = 'Enter a valid email address';
    if (values.password.length < 8) problems.password = 'Password must be at least 8 characters';
    setErrors(problems);
    setFormError('');
    if (Object.keys(problems).length > 0) return;

    inFlight.current = true;
    setSubmitting(true);
    try {
      const session = await registerRequest({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      login(session);
      toast.success('Account created. Welcome aboard!');
      navigate('/tasks', { replace: true });
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (err.response?.data?.error?.code === 'EMAIL_TAKEN') {
        setErrors({ email: 'An account with this email already exists' });
      } else {
        setErrors(fieldErrors);
        if (Object.keys(fieldErrors).length === 0) {
          setFormError(getErrorMessage(err, 'Registration failed'));
        }
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const field = (name, label, type, autoComplete, hint) => (
    <div className="field">
      <label htmlFor={`register-${name}`}>{label}</label>
      <input
        id={`register-${name}`}
        type={type}
        autoComplete={autoComplete}
        value={values[name]}
        onChange={setField(name)}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `register-${name}-error` : undefined}
      />
      {hint && !errors[name] && <p className="field-hint">{hint}</p>}
      {errors[name] && (
        <p className="field-error" id={`register-${name}-error`}>
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <main className="auth-page">
      <form
        className="auth-card"
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="register-title"
      >
        <h1 id="register-title" className="auth-title">
          Create Account
        </h1>
        <p className="auth-subtext">Join to organise your tasks by priority and due date.</p>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        {field('name', 'Name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        {field('password', 'Password', 'password', 'new-password', 'At least 8 characters')}

        <button type="submit" className="auth-button" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Register'}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </main>
  );
}
