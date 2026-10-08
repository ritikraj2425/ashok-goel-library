'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getCabinStatus, getMyActiveBookings, cancelPendingBooking, cancelApprovedBooking } from '@/lib/api';
import Header from '@/components/Header';
import CabinCard from '@/components/CabinCard';
import ActiveBookingBanner from '@/components/ActiveBookingBanner';
import BookingModal from '@/components/BookingModal';
import LoadingSpinner from '@/components/LoadingSpinner';

const POLL_INTERVAL = 20000; // 20 seconds

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [cabins, setCabins] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [slotsUsedToday, setSlotsUsedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCabin, setSelectedCabin] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [bookingsLocked, setBookingsLocked] = useState(false);
  const [bookingUnlockTime, setBookingUnlockTime] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [cabinData, bookingData] = await Promise.all([
        getCabinStatus(),
        getMyActiveBookings(),
      ]);
      setCabins(cabinData.cabins || []);
      setBookingsLocked(cabinData.bookingsLocked || false);
      setBookingUnlockTime(cabinData.bookingUnlockTime || null);
      setActiveBookings(bookingData.bookings || []);
      setSlotsUsedToday(bookingData.slotsUsedToday || 0);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }
    if (user) {
      fetchData();
    }
  }, [user, authLoading, router, fetchData]);

  // Polling
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user, fetchData]);

  const handleBookSuccess = () => {
    setSelectedCabin(null);
    setSuccessMessage('Booking request created successfully.');
    fetchData();
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const handleCancelPending = async (bookingId) => {
    setCancellingId(bookingId);
    try {
      await cancelPendingBooking(bookingId);
      setSuccessMessage('Booking request cancelled.');
      fetchData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancelApproved = async (bookingId) => {
    setCancellingId(bookingId);
    try {
      await cancelApprovedBooking(bookingId);
      setSuccessMessage('Booking cancelled successfully.');
      fetchData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
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

  return (
    <>
      <Header />
      <main className="page-container">
        <h2 className="page-title">Study Cabins</h2>
        <p className="page-subtitle">View availability and book a cabin for your study group.</p>

        {(!user?.isBlocked && (!user?.blockedUntil || new Date(user.blockedUntil) <= new Date())) && (
          <div className="alert alert-warning" style={{ marginBottom: 'var(--space-md)' }}>
            <strong>⚠️ IMPORTANT:</strong> Missing a check-in will result in a 2-day temporary block for <strong>YOU AND ALL MEMBERS OF YOUR GROUP</strong>. Please make sure to check in at the library desk within 10 minutes of your slot start time.
          </div>
        )}

        {user?.isBlocked ? (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
            <strong>Account Permanently Blocked:</strong> Your account was permanently blocked{user?.blockedAt ? ` on ${formatDate(user.blockedAt)}` : ''}. Contact administration for more information.
          </div>
        ) : user?.blockedUntil && new Date(user.blockedUntil) > new Date() ? (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
            <strong>Account Temporarily Blocked:</strong> You were temporarily blocked{user?.blockedAt ? ` on ${formatDate(user.blockedAt)}` : ''} and are restricted from booking cabins until {formatDate(user.blockedUntil)}.
          </div>
        ) : null}

        {successMessage && <div className="alert alert-success">{successMessage}</div>}
        {error && !error.includes('blocked') && <div className="alert alert-error">{error}</div>}

        {bookingsLocked && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span>
              <strong>Bookings are currently locked.</strong>{' '}
              {bookingUnlockTime
                ? `Bookings for today will open at ${new Date(bookingUnlockTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}.`
                : 'The library is closed today.'}
            </span>
          </div>
        )}

        {activeBookings.length > 0 && activeBookings.map(booking => (
          <ActiveBookingBanner
            key={booking._id}
            booking={booking}
            onCancel={handleCancelPending}
            cancelling={cancellingId === booking._id}
            onCancelApproved={handleCancelApproved}
          />
        ))}

        {cabins.length > 0 && !bookingsLocked && (
          <div style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <strong>Daily Quota:</strong> You have used {slotsUsedToday} of your 2 daily slots.
            {slotsUsedToday >= 2 && <span style={{ color: 'var(--color-error)', marginLeft: 'var(--space-sm)' }}>(Quota limit reached)</span>}
          </div>
        )}

        <div className="cabin-grid">
          {cabins.map((cabin) => (
            <CabinCard
              key={cabin.id}
              cabin={cabin}
              hasActiveBooking={slotsUsedToday >= 2}
              onBook={setSelectedCabin}
              bookingsLocked={bookingsLocked}
              isUserBlocked={user?.isBlocked || (user?.blockedUntil && new Date(user.blockedUntil) > new Date())}
            />
          ))}
        </div>

        {cabins.length === 0 && !loading && (
          <div className="empty-state">
            <h3>No cabins available</h3>
            <p>Please check back later.</p>
          </div>
        )}

        <div className="rules-section">
          <h3>Library Cabin Booking Rules</h3>
          <ul>
            <li>Cabins can be booked for the current day only. The booking portal unlocks 30 minutes before the library's first available slot of the day.</li>
            <li>A student can book a maximum of 2 slots in a day.</li>
            <li><strong>Group Bookings:</strong> If a cabin requires multiple people, you must share the invite link or QR code with your group. All members must join within 10 minutes, or the request will expire.</li>
            <li><strong>Auto-Approval:</strong> Bookings are automatically approved immediately (or as soon as all group members join).</li>
            <li>Students must physically check-in at the library desk within 10 minutes of the slot start time.</li>
            <li><strong>Penalties:</strong> Missing a check-in results in an automatic 2-day temporary block for all members of the group.</li>
            <li>Cancelling an approved booking 3 times in a week results in a permanent block. (Cancelling a pending group invite does <em>not</em> count as a strike).</li>
            <li>If you are leaving the cabin before your booked time slot ends, please inform the library team for an early checkout.</li>
          </ul>
        </div>

        {selectedCabin && (
          <BookingModal
            cabin={selectedCabin}
            onClose={() => {
              setSelectedCabin(null);
              fetchData();
            }}
            onSuccess={handleBookSuccess}
            remainingSlots={Math.max(0, 2 - slotsUsedToday)}
          />
        )}
      </main>
    </>
  );
}
