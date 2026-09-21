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
    setSuccessMessage('Booking request submitted successfully. Awaiting admin approval.');
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

        {user?.isBlocked ? (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
            <strong>Account Blocked:</strong> Your account has been permanently blocked from booking cabins. Contact administration for more information.
          </div>
        ) : user?.blockedUntil && new Date(user.blockedUntil) > new Date() ? (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
            <strong>Account Temporarily Blocked:</strong> Due to a missed check-in, you are blocked from booking cabins until {new Date(user.blockedUntil).toLocaleString()}.
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
            <li>A Student can book a maximum of 2 slots in a day.</li>
            <li>Each slot must be approved by an admin within 15 mins of the request.</li>
            <li>Students must check-in within 10 mins of the slot start time.</li>
            <li>Missing check-in results in a two-day temporary block.</li>
            <li>Cancelling an approved booking 3 times in a week results in a permanent block.</li>
            <li>To appeal a permanent block, you must meet with the library team.</li>
            <li>If you are leaving the cabin before your booked time slot ends, please inform the library team for checkout.</li>
          </ul>
        </div>

        {selectedCabin && (
          <BookingModal
            cabin={selectedCabin}
            onClose={() => setSelectedCabin(null)}
            onSuccess={handleBookSuccess}
            remainingSlots={Math.max(0, 2 - slotsUsedToday)}
          />
        )}
      </main>
    </>
  );
}
