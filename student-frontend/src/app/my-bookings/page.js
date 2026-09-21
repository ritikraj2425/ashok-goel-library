'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getMyBookingHistory } from '@/lib/api';
import Header from '@/components/Header';
import StatusBadge from '@/components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';

const formatTimeSlot = (slotStr) => {
  if (!slotStr) return '';
  const formatTime = (time24) => {
    const [h, m] = time24.split(':');
    if (!h || !m) return time24;
    const hour = parseInt(h, 10);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${suffix}`;
  };

  if (slotStr.includes('-')) {
    return slotStr.split('-').map(t => formatTime(t.trim())).join(' - ');
  }
  return formatTime(slotStr);
};

const formatBookingTimeSlot = (booking) => {
  if (booking.timeSlotIds && booking.timeSlotIds.length > 1) {
    const firstSlot = booking.timeSlotIds[0];
    const lastSlot = booking.timeSlotIds[booking.timeSlotIds.length - 1];
    const start = firstSlot.split('-')[0];
    const end = lastSlot.split('-')[1];
    return formatTimeSlot(`${start}-${end}`);
  }
  return formatTimeSlot(booking.timeSlotId);
};

export default function MyBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState(null);

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
        <p className="page-subtitle">View your booking history. Click on a booking for more details.</p>

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
                    <th>Date</th>
                    <th>Slot</th>
                    <th>Cabin</th>
                    <th>People</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr 
                      key={booking._id} 
                      onClick={() => setSelectedBooking(booking)}
                      style={{ cursor: 'pointer' }}
                      className="table-row-hover"
                    >
                      <td>{booking.bookingDate}</td>
                      <td>{formatBookingTimeSlot(booking)}</td>
                      <td>
                        <strong>{booking.cabinId?.name || booking.cabinId?.code || '-'}</strong>
                      </td>
                      <td>{booking.peopleCount}</td>
                      <td>
                        <StatusBadge status={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
      </main>

      {selectedBooking && (
        <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Booking Details</h2>
              <button className="btn btn-ghost" onClick={() => setSelectedBooking(null)}>Close</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div><strong>Cabin:</strong> {selectedBooking.cabinId?.name} ({selectedBooking.cabinId?.code})</div>
                <div><strong>Date:</strong> {selectedBooking.bookingDate}</div>
                <div><strong>Slot:</strong> {formatBookingTimeSlot(selectedBooking)}</div>
                <div><strong>Status:</strong> <StatusBadge status={selectedBooking.status} /></div>
                
                <div style={{ borderTop: '1px solid var(--color-border)', margin: 'var(--space-sm) 0' }}></div>
                
                <div><strong>Requested At:</strong> {formatDate(selectedBooking.requestedAt)}</div>
                {selectedBooking.approvedAt && <div><strong>Approved At:</strong> {formatDate(selectedBooking.approvedAt)}</div>}
                
                {(selectedBooking.rejectionReason || selectedBooking.cancellationReason) && (
                  <div>
                    <strong>Remarks:</strong>{' '}
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {selectedBooking.rejectionReason || selectedBooking.cancellationReason}
                    </span>
                  </div>
                )}

                {selectedBooking.groupMembers && selectedBooking.groupMembers.length > 0 && (
                  <div>
                    <strong>Group Members:</strong>
                    <ul style={{ paddingLeft: '20px', marginTop: 'var(--space-xs)' }}>
                      {selectedBooking.groupMembers.map((m, i) => (
                        <li key={i}>{m.name} ({m.enrollmentNumber})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
