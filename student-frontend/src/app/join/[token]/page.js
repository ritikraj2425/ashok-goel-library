'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getJoinInfo, joinGroupBooking } from '@/lib/api';
import Header from '@/components/Header';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const token = params.token;

  const [joinInfo, setJoinInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(null);

  // Fetch join info
  useEffect(() => {
    if (!token || authLoading) return;

    if (!user) {
      sessionStorage.setItem('redirectUrl', window.location.pathname);
      router.push('/');
      return;
    }

    const fetchInfo = async () => {
      try {
        const info = await getJoinInfo(token);
        setJoinInfo(info);
      } catch (err) {
        setError(err.message || 'Invalid or expired invite link.');
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [token, user, authLoading]);

  // Countdown timer
  useEffect(() => {
    if (!joinInfo?.joinExpiresAt) return;

    const updateCountdown = () => {
      const remaining = Math.max(0, new Date(joinInfo.joinExpiresAt).getTime() - Date.now());
      setCountdown(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [joinInfo]);

  const formatCountdown = (ms) => {
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeSlots = (timeSlotIds) => {
    if (!timeSlotIds || timeSlotIds.length === 0) return 'Unknown';
    return timeSlotIds.map(slot => {
      const [start, end] = slot.split('-');
      const formatTime = (t) => {
        const [h, m] = t.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m} ${ampm}`;
      };
      return `${formatTime(start)} - ${formatTime(end)}`;
    }).join(', ');
  };

  const handleJoin = async () => {
    setJoining(true);
    setError('');
    try {
      const result = await joinGroupBooking(token);
      setSuccess(result.message || 'Successfully joined the group!');
      if (result.groupFull) {
        setTimeout(() => router.push('/dashboard'), 3000);
      } else {
        setTimeout(() => router.push('/dashboard'), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to join the group.');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <LoadingSpinner />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Header />
        <LoadingSpinner />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="page-container" style={{ paddingTop: 'var(--space-xl)' }}>
        <div style={{
          maxWidth: '500px',
          margin: '0 auto',
          padding: 'var(--space-xl)',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}></div>
              <h2 style={{ color: 'var(--color-success)', marginBottom: 'var(--space-md)' }}>Joined Successfully!</h2>
              <p style={{ color: 'var(--color-text-secondary)' }}>{success}</p>
              <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
                Redirecting to dashboard...
              </p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>️</div>
              <h2 style={{ marginBottom: 'var(--space-md)' }}>Cannot Join</h2>
              <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>{error}</div>
              <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </button>
            </div>
          ) : joinInfo ? (
            <>
              <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}> Cabin Booking Invite</h2>

              <div style={{
                background: 'var(--color-bg)',
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-lg)',
              }}>
                <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
                  <div><strong>Invited by:</strong> {joinInfo.hostName}</div>
                  <div><strong>Cabin:</strong> {joinInfo.cabinName} ({joinInfo.cabinCode})</div>
                  <div><strong>Date:</strong> {joinInfo.bookingDate}</div>
                  <div><strong>Time:</strong> {formatTimeSlots(joinInfo.timeSlotIds)}</div>
                  <div><strong>Group Size:</strong> {joinInfo.peopleCount} people (including host)</div>
                  <div><strong>Waiting for:</strong> {joinInfo.spotsRemaining} more member(s) to join</div>
                </div>
              </div>

              {/* Countdown */}
              {countdown !== null && (
                <div style={{
                  textAlign: 'center',
                  marginBottom: 'var(--space-lg)',
                  padding: 'var(--space-sm)',
                  background: countdown < 60000 ? 'var(--color-error-bg, #fef2f2)' : 'var(--color-bg)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${countdown < 60000 ? 'var(--color-error)' : 'var(--color-border)'}`,
                }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Invite expires in</div>
                  <div style={{
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 700,
                    color: countdown < 60000 ? 'var(--color-error)' : 'var(--color-primary)',
                  }}>
                    {countdown > 0 ? formatCountdown(countdown) : 'Expired'}
                  </div>
                </div>
              )}

              {/* Join info */}
              <div style={{
                background: 'var(--color-bg)',
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-lg)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Joining as</div>
                <div style={{ fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{user.email}</div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: 'var(--space-md)' }}
                onClick={handleJoin}
                disabled={joining || (countdown !== null && countdown <= 0)}
              >
                {joining ? 'Joining...' : countdown !== null && countdown <= 0 ? 'Invite Expired' : 'Accept & Join Group'}
              </button>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}
