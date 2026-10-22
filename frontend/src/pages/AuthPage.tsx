import { useState, type FormEvent } from 'react';
import { Leaf, ShieldCheck } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import styles from './AuthPage.module.css';

interface AuthPageProps {
  initialMode: 'login' | 'register';
}

export default function AuthPage({ initialMode }: AuthPageProps) {
  const { user, authLoading, authError, signIn, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) return <main className={styles.page}>Checking your session…</main>;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      if (initialMode === 'register') {
        await register(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <Link className={styles.brand} to="/">
          <span className={styles.brandMark}><Leaf size={18} /></span>
          <span>EcoPath<span className={styles.brandAccent}>.AI</span></span>
        </Link>
        <div className={styles.heading}>
          <span className={styles.eyebrow}><ShieldCheck size={14} /> Private to your account</span>
          <h1>{initialMode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p>
            {initialMode === 'login'
              ? 'Sign in to continue to your workspaces and saved sustainability records.'
              : 'Create an account to keep your workspaces and records saved for your next visit.'}
          </p>
        </div>
        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="account-email">Email address</label>
          <input
            id="account-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="account-password">Password</label>
          <input
            id="account-password"
            type="password"
            autoComplete={initialMode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {initialMode === 'register' && (
            <span className={styles.hint}>Use at least 8 characters. Your password is never stored in plain text.</span>
          )}
          {(formError || authError) && (
            <p className={styles.error} role="alert">{formError || authError}</p>
          )}
          <button className={styles.submit} type="submit" disabled={submitting}>
            {submitting
              ? 'Please wait…'
              : initialMode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
          </button>
        </form>
        <p className={styles.switchMode}>
          {initialMode === 'login' ? 'New to EcoPath.AI?' : 'Already have an account?'}
          <Link to={initialMode === 'login' ? '/signup' : '/login'}>
              {initialMode === 'login' ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
      </div>
    </main>
  );
}
