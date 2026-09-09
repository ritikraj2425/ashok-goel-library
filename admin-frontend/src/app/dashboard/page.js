'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth';
import { getDashboard, approveBooking, rejectBooking, cancelBooking, getBookingDetail, checkInBooking } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import CountdownTimer from '@/components/CountdownTimer';
import ConfirmDialog from '@/components/ConfirmDialog';

const POLL_INTERVAL = 10000;

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

export default function AdminDashboardPage() {
  const { admin, loading: authLoading } = useAdminAuth();
  const router = useRouter();

  const [data, setData] = useState({
    pendingRequests: [], checkInRequired: [],
    ongoingBookings: [], upcomingBookings: [], cabinAvailability: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getDashboard();
      setData(result);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !admin) { router.push('/login'); return; }
    if (admin) fetchData();
  }, [admin, authLoading, router, fetchData]);

  useEffect(() => {
    if (!admin) return;
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [admin, fetchData]);

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const handleApprove = (id) => {
    setConfirm({
      title: 'Approve Booking',
      message: 'Are you sure you want to approve this booking request? The slot will be reserved for this student.',
      confirmLabel: 'Approve',
      confirmClass: 'btn-success',
      onConfirm: async () => {
        await approveBooking(id);
        setConfirm(null);
        showSuccess('Booking approved successfully');
        fetchData();
      },
    });
  };



  const handleCheckIn = (id) => {
    setConfirm({
      title: 'Check In Student',
      message: 'Confirm that the student has arrived and checked in for their slot.',
      confirmLabel: 'Check In',
      confirmClass: 'btn-success',
      onConfirm: async () => {
        await checkInBooking(id);
        setConfirm(null);
        showSuccess('Student checked in successfully');
        fetchData();
      },
    });
  };

  const handleReject = (id) => {
    setConfirm({
      title: 'Reject Booking',
      message: 'Are you sure you want to reject this booking request?',
      confirmLabel: 'Reject',
      confirmClass: 'btn-danger',
      showReason: true,
      onConfirm: async (reason) => {
        await rejectBooking(id, reason);
        setConfirm(null);
        showSuccess('Booking rejected');
        fetchData();
      },
    });
  };

  const handleCancelByAdmin = (id) => {
    setConfirm({
      title: 'Cancel Booking',
      message: 'Are you sure you want to cancel this booking? This is an admin action.',
      confirmLabel: 'Cancel Booking',
      confirmClass: 'btn-danger',
      showReason: true,
      onConfirm: async (reason) => {
        await cancelBooking(id, reason);
        setConfirm(null);
        showSuccess('Booking cancelled');
        fetchData();
      },
    });
  };

  const handleCheckout = (id) => {
    setConfirm({
      title: 'Early Checkout',
      message: 'Are you sure you want to check out this student early?',
      confirmLabel: 'Checkout',
      confirmClass: 'btn-danger',
      showReason: true,
      onConfirm: async (reason) => {
        await cancelBooking(id, reason);
        setConfirm(null);
        showSuccess('Student checked out early');
        fetchData();
      },
    });
  };

  const handleViewDetail = async (id) => {
    setDetailBooking({ loading: true, _id: id });
    try {
      const result = await getBookingDetail(id);
      setDetailBooking(result.booking);
    } catch (err) {
      setError(err.message);
      setDetailBooking(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="admin-layout">
        <Sidebar />
        <main className="admin-content"><div className="loading-container"><div className="spinner" /></div></main>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Manage cabin bookings in real time.</p>

        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {/* ─── Section 1: Pending Requests ─── */}
        <div className="dashboard-section">
          <h3 className="section-title">Pending Requests ({data.pendingRequests.length})</h3>
          {data.pendingRequests.length === 0 ? (
            <div className="empty-state"><p>No pending requests</p></div>
          ) : (
            <div className="dashboard-grid">
              {data.pendingRequests.map((booking) => (
                <div key={booking._id} className="card booking-card">
                  <div className="booking-card-header">
                    <h4>{booking.cabinId?.name || 'Cabin'}</h4>
                    <span className="badge badge-pending">Pending</span>
                  </div>
                  <div className="booking-card-details">
                    <div className="booking-card-detail"><span className="label">Date</span>{booking.bookingDate}</div>
                    <div className="booking-card-detail"><span className="label">Slot</span>{formatTimeSlot(booking.timeSlotId)}</div>
                    <div className="booking-card-detail"><span className="label">Student</span>{booking.mainStudent.name}</div>
                    <div className="booking-card-detail" title={booking.studentUserId?.email || '-'}><span className="label">Email</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booking.studentUserId?.email || '-'}</span></div>
                    <div className="booking-card-detail"><span className="label">Enrollment</span>{booking.mainStudent.enrollmentNumber}</div>
                    <div className="booking-card-detail"><span className="label">Phone</span>{booking.mainStudent.phoneNumber}</div>
                    <div className="booking-card-detail"><span className="label">People</span>{booking.peopleCount}</div>
                    {booking.groupMembers?.length > 0 && (
                      <div className="booking-card-detail" style={{ flexDirection: 'column', gap: 4 }}>
                        <span className="label">Group Members</span>
                        {booking.groupMembers.map((m, i) => (
                          <span key={i} style={{ fontSize: 'var(--font-size-xs)', paddingLeft: 'var(--space-sm)' }}>
                            {m.name} ({m.enrollmentNumber})
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="booking-card-detail">
                      <span className="label">Auto-reject</span>
                      <CountdownTimer targetDate={booking.approvalDeadlineAt} />
                    </div>
                  </div>
                  <div className="booking-card-actions">
                    <button className="btn btn-success btn-sm" onClick={() => handleApprove(booking._id)}>Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleReject(booking._id)}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>



        {/* ─── Section 3: Awaiting Check-in ─── */}
        <div className="dashboard-section" style={{ backgroundColor: 'rgba(244,67,54,0.05)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-error)' }}>
          <h3 className="section-title" style={{ color: 'var(--color-error)' }}>
            Awaiting Check-in ({data.checkInRequired?.length || 0})
            <span style={{ fontSize: 'var(--font-size-sm)', marginLeft: 'var(--space-sm)', fontWeight: 'normal' }}>
              — Students must be checked in within 10 min or auto-blocked for 2 days
            </span>
          </h3>
          {!data.checkInRequired || data.checkInRequired.length === 0 ? (
            <div className="empty-state"><p>No pending check-ins</p></div>
          ) : (
            <div className="dashboard-grid">
              {data.checkInRequired.map((booking) => (
                <div key={booking._id} className="card booking-card" style={{ borderColor: 'var(--color-error)', cursor: 'pointer' }} onClick={() => handleViewDetail(booking._id)}>
                  <div className="booking-card-header">
                    <h4>{booking.cabinId?.name || 'Cabin'}</h4>
                    <span className="badge badge-rejected">
                      {booking.status === 'cancel_requested' ? 'Cancel + Time Started' : 'Check In Required'}
                    </span>
                  </div>
                  <div className="booking-card-details">
                    <div className="booking-card-detail"><span className="label">Student</span>{booking.mainStudent.name}</div>
                    <div className="booking-card-detail" title={booking.studentUserId?.email || '-'}><span className="label">Email</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booking.studentUserId?.email || '-'}</span></div>
                    <div className="booking-card-detail"><span className="label">Slot</span>{formatTimeSlot(booking.timeSlotId)}</div>
                    <div className="booking-card-detail">
                      <span className="label">Deadline</span>
                      <CountdownTimer targetDate={booking.checkInDeadlineAt} />
                    </div>
                  </div>
                  <div className="booking-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-success btn-sm" onClick={() => handleCheckIn(booking._id)}>Check In</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Section 4: Ongoing (Checked In) ─── */}
        <div className="dashboard-section">
          <h3 className="section-title">Ongoing Sessions ({data.ongoingBookings.length})</h3>
          {data.ongoingBookings.length === 0 ? (
            <div className="empty-state"><p>No ongoing sessions</p></div>
          ) : (
            <div className="dashboard-grid">
              {data.ongoingBookings.map((booking) => (
                <div key={booking._id} className="card booking-card" style={{ cursor: 'pointer' }} onClick={() => handleViewDetail(booking._id)}>
                  <div className="booking-card-header">
                    <h4>{booking.cabinId?.name || 'Cabin'}</h4>
                    <span className="badge badge-available">Checked In</span>
                  </div>
                  <div className="booking-card-details">
                    <div className="booking-card-detail"><span className="label">Student</span>{booking.mainStudent.name}</div>
                    <div className="booking-card-detail" title={booking.studentUserId?.email || '-'}><span className="label">Email</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booking.studentUserId?.email || '-'}</span></div>
                    <div className="booking-card-detail"><span className="label">Slot</span>{formatTimeSlot(booking.timeSlotId)}</div>
                    <div className="booking-card-detail">
                      <span className="label">Ends in</span>
                      <CountdownTimer targetDate={booking.endTime} />
                    </div>
                  </div>
                  <div className="booking-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-danger btn-sm" onClick={() => handleCheckout(booking._id)}>Checkout</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Section 5: Upcoming Approved ─── */}
        <div className="dashboard-section">
          <h3 className="section-title">Upcoming Approved ({data.upcomingBookings.length})</h3>
          {data.upcomingBookings.length === 0 ? (
            <div className="empty-state"><p>No upcoming bookings</p></div>
          ) : (
            <div className="dashboard-grid">
              {data.upcomingBookings.map((booking) => (
                <div key={booking._id} className="card booking-card" style={{ cursor: 'pointer' }} onClick={() => handleViewDetail(booking._id)}>
                  <div className="booking-card-header">
                    <h4>{booking.cabinId?.name || 'Cabin'}</h4>
                    <span className="badge badge-booked">Approved</span>
                  </div>
                  <div className="booking-card-details">
                    <div className="booking-card-detail"><span className="label">Student</span>{booking.mainStudent.name}</div>
                    <div className="booking-card-detail" title={booking.studentUserId?.email || '-'}><span className="label">Email</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booking.studentUserId?.email || '-'}</span></div>
                    <div className="booking-card-detail"><span className="label">Slot</span>{formatTimeSlot(booking.timeSlotId)}</div>

                  </div>
                  <div className="booking-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-danger btn-sm" onClick={() => handleCancelByAdmin(booking._id)}>Cancel Booking</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Section 6: Cabin Availability ─── */}
        <div className="dashboard-section">
          <h3 className="section-title">Cabin Availability ({data.cabinAvailability?.length || 0})</h3>
          <div className="dashboard-grid">
            {(data.cabinAvailability || []).map((cabin) => (
              <div key={cabin._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4>{cabin.name}</h4>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{cabin.code}</span>
                  </div>
                  <span className={`badge ${cabin.availableSlots.length > 0 ? 'badge-available' : 'badge-inactive'}`}>
                    {cabin.availableSlots.length > 0 ? `${cabin.availableSlots.length} slots free` : 'Fully booked'}
                  </span>
                </div>
                <div style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Capacity: {cabin.minPeople} - {cabin.maxPeople}
                </div>
                {cabin.availableSlots.length > 0 && (
                  <div style={{ marginTop: 'var(--space-md)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Available Slots</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                      {cabin.availableSlots.map(slot => (
                        <span key={slot.id} className="badge badge-available" style={{ fontSize: '11px', padding: '2px 8px' }}>{formatTimeSlot(slot.id)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Confirm Dialog */}
        {confirm && (
          <ConfirmDialog
            title={confirm.title}
            message={confirm.message}
            confirmLabel={confirm.confirmLabel}
            confirmClass={confirm.confirmClass}
            showReason={confirm.showReason}
            onConfirm={confirm.onConfirm}
            onCancel={() => setConfirm(null)}
          />
        )}

        {/* Booking Detail Modal */}
        {detailBooking && (
          <div className="modal-overlay" onClick={() => setDetailBooking(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Booking Details</h2>
                <button className="btn btn-ghost" onClick={() => setDetailBooking(null)}>Close</button>
              </div>
              <div className="modal-body">
                {detailBooking.loading ? (
                  <div className="loading-container"><div className="spinner" /></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <div><strong>Cabin:</strong> {detailBooking.cabinId?.name}</div>
                    <div><strong>Date:</strong> {detailBooking.bookingDate}</div>
                    <div><strong>Slot:</strong> {formatTimeSlot(detailBooking.timeSlotId)}</div>
                    <div>
                      <strong>Status:</strong>
                      <span className={`badge badge-${detailBooking.status === 'approved' ? 'booked' : detailBooking.status}`} style={{ marginLeft: 'var(--space-xs)' }}>
                        {detailBooking.status === 'no_show' ? 'Missed Check-in' :
                          detailBooking.status === 'early_checkout' ? 'Early Checkout' :
                          detailBooking.status === 'cancelled_by_admin' ? 'Admin Cancelled' :
                          detailBooking.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                    <div><strong>Main Student:</strong> {detailBooking.mainStudent.name}</div>
                    <div><strong>Enrollment:</strong> {detailBooking.mainStudent.enrollmentNumber}</div>
                    <div><strong>Phone:</strong> {detailBooking.mainStudent.phoneNumber}</div>
                    <div><strong>People Count:</strong> {detailBooking.peopleCount}</div>
                    {detailBooking.groupMembers?.length > 0 && (
                      <div>
                        <strong>Group Members:</strong>
                        <ul style={{ paddingLeft: 'var(--space-lg)', marginTop: 'var(--space-xs)' }}>
                          {detailBooking.groupMembers.map((m, i) => (
                            <li key={i} style={{ fontSize: 'var(--font-size-sm)' }}>{m.name} ({m.enrollmentNumber})</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {detailBooking.rejectionReason && <div><strong>Rejection Reason:</strong> {detailBooking.rejectionReason}</div>}
                    {detailBooking.cancellationReason && <div><strong>Cancellation Reason:</strong> {detailBooking.cancellationReason}</div>}
                    <div><strong>Requested:</strong> {new Date(detailBooking.requestedAt).toLocaleString()}</div>
                    {detailBooking.approvedAt && <div><strong>Approved:</strong> {new Date(detailBooking.approvedAt).toLocaleString()}</div>}
                    {detailBooking.checkedInAt && <div><strong>Checked In:</strong> {new Date(detailBooking.checkedInAt).toLocaleString()}</div>}
                    {detailBooking.cancelRequestedAt && <div><strong>Cancel Requested:</strong> {new Date(detailBooking.cancelRequestedAt).toLocaleString()}</div>}
                    {detailBooking.approvedBy && <div><strong>Approved By:</strong> {detailBooking.approvedBy.username}</div>}
                    {detailBooking.studentUserId && <div><strong>Account:</strong> {detailBooking.studentUserId.email}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
