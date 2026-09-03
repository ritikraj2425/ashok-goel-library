'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { loginWithGoogle } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

function LoginContent() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoggingIn(true);
    try {
      const data = await loginWithGoogle(credentialResponse.credential);
      login(data.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in failed. Please try again.');
  };

  if (loading) return <LoadingSpinner />;
  if (user) return <LoadingSpinner />;

  return (
    <div className="login-page">
      <div className="card login-card">
        <h1>Ashok Goel Library</h1>
        <p className="subtitle">Cabin Booking Portal</p>

        <div className="divider">Sign in to continue</div>

        {error && <div className="alert alert-error">{error}</div>}

        {loggingIn ? (
          <LoadingSpinner />
        ) : (
          <div className="google-btn-wrapper">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
              width="300"
            />
          </div>
        )}

        <p className="note">
          Only Rishihood University email addresses are accepted.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <div className="login-page">
        <div className="card login-card">
          <h1>Configuration Error</h1>
          <p className="subtitle">Google Client ID is not configured.</p>
          <p className="note">Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment variables.</p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <LoginContent />
    </GoogleOAuthProvider>
  );
}
