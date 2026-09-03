'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getMyBookingHistory } from '@/lib/api';
import Header from '@/components/Header';
import StatusBadge from '@/components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function MyBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchHistory = useCallback(async (p) => {
    try {
      const data = await getMyBookingHistory(p);
      setBookings(data.bookings || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to load history:', err);
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
      fetchHistory(page);
    }
  }, [user, authLoading, router, fetchHistory, page]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        <h2 className="page-title">My Bookings</h2>
        <p className="page-subtitle">View your booking history.</p>

        {bookings.length === 0 ? (
          <div className="empty-state">
            <h3>No booking history</h3>
            <p>You have not made any booking requests yet.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Cabin</th>
                    <th>People</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking._id}>
                      <td>
                        <strong>{booking.cabinId?.name || booking.cabinId?.code || '-'}</strong>
                      </td>
                      <td>{booking.peopleCount}</td>
                      <td>
                        <StatusBadge status={booking.status} />
                      </td>
                      <td>{formatDate(booking.requestedAt)}</td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', maxWidth: '200px' }}>
                        {booking.rejectionReason || booking.cancellationReason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </>
  );
}
