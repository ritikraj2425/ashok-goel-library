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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCabin, setSelectedCabin] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [cabinData, bookingData] = await Promise.all([
        getCabinStatus(),
        getMyActiveBookings(),
      ]);
      setCabins(cabinData.cabins || []);
      setActiveBookings(bookingData.bookings || []);
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

        {user?.isBlocked && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
            <strong>Account Blocked:</strong> Your account has been permanently blocked from booking cabins. Contact administration for more information.
          </div>
        )}

        {user?.blockedUntil && new Date(user.blockedUntil) > new Date() && !user?.isBlocked && (
          <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>
            <strong>Account Temporarily Blocked:</strong> Due to a missed check-in, you are blocked from booking cabins until {new Date(user.blockedUntil).toLocaleString()}.
          </div>
        )}

        {successMessage && <div className="alert alert-success">{successMessage}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {activeBookings.length > 0 && activeBookings.map(booking => (
          <ActiveBookingBanner
            key={booking._id}
            booking={booking}
            onCancel={handleCancelPending}
            cancelling={cancellingId === booking._id}
            onCancelApproved={handleCancelApproved}
          />
        ))}

        <div className="cabin-grid">
          {cabins.map((cabin) => (
            <CabinCard
              key={cabin.id}
              cabin={cabin}
              hasActiveBooking={false}
              onBook={setSelectedCabin}
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
            <li>Cabins for the day can be booked on the same day and all requests will only get approved after 9:00 AM.</li>
            <li>Students can book a cabin for a one-hour slot.</li>
            <li>An enrollment number can book a maximum of 2 slots in a day.</li>
            <li>Each slot must be approved by an admin within 15 mins of the request.</li>
            <li>Students must check-in within 10 mins of the slot start time.</li>
            <li>Missing check-in results in a two-day block.</li>
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
          />
        )}
      </main>
    </>
  );
}
