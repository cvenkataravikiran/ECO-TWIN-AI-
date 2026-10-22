import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getSessionUser,
  loginAccount,
  logoutAccount,
  registerAccount,
  type AuthUser,
} from '@/services/api';

interface AuthContextValue {
  user: AuthUser | null;
  authLoading: boolean;
  authError: string;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let mounted = true;
    getSessionUser()
      .then((sessionUser) => {
        if (mounted) setUser(sessionUser);
      })
      .catch((error: unknown) => {
        console.error('Unable to restore the account session', error);
        if (mounted) {
          setUser(null);
          setAuthError(error instanceof Error ? error.message : 'Unable to verify your session.');
        }
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError('');
    const account = await loginAccount(email, password);
    setUser(account);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setAuthError('');
    const account = await registerAccount(email, password);
    setUser(account);
  }, []);

  const signOut = useCallback(async () => {
    setAuthError('');
    try {
      await logoutAccount();
      setUser(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log out.';
      setAuthError(message);
      throw error;
    }
  }, []);

  return (
    <AuthContext value={{ user, authLoading, authError, signIn, register, signOut }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
