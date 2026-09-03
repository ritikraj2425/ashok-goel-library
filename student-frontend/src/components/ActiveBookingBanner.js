'use client';

import { useState } from 'react';
import StatusBadge from './StatusBadge';
import CountdownTimer from './CountdownTimer';
import ConfirmDialog from './ConfirmDialog';

export default function ActiveBookingBanner({ booking, onCancel, cancelling, onCancelApproved }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  
  if (!booking) return null;

  const isPending = booking.status === 'pending';
  const isApproved = booking.status === 'approved';
  const isCancelRequested = booking.status === 'cancel_requested';
  const isAwaitingCheckin = booking.status === 'awaiting_checkin';
  const isCheckedIn = booking.status === 'checked_in';
  const cabinName = booking.cabinId?.name || booking.cabinId?.code || 'Cabin';
  const now = new Date();
  const hasStarted = booking.startTime && new Date(booking.startTime) <= now;

  let title = 'Your Active Booking';
  if (isPending) title = 'Your Pending Request';
  else if (isAwaitingCheckin) title = 'Awaiting Check-in (Go to Cabin)';
  else if (isCheckedIn) title = 'Your Active Session';

  return (
    <div className={`active-booking-banner ${isPending ? 'pending' : isAwaitingCheckin ? 'warning' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <h3>
          {title} - {cabinName}
        </h3>
        <StatusBadge status={booking.status} />
      </div>

      <div className="booking-details">
        <div className="booking-detail">
          <span className="label">Main Student</span>
          {booking.mainStudent.name}
        </div>
        <div className="booking-detail">
          <span className="label">Enrollment</span>
          {booking.mainStudent.enrollmentNumber}
        </div>
        <div className="booking-detail">
          <span className="label">Phone</span>
          {booking.mainStudent.phoneNumber}
        </div>
        <div className="booking-detail">
          <span className="label">People Count</span>
          {booking.peopleCount}
        </div>
        <div className="booking-detail">
          <span className="label">Date</span>
          {booking.bookingDate}
        </div>
        <div className="booking-detail">
          <span className="label">Time Slot</span>
          {booking.timeSlotId}
        </div>
        {(!isPending && !hasStarted) ? (
          <div className="booking-detail">
            <span className="label">Starts at</span>
            <span>{new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ) : (
          <div className="booking-detail">
            <span className="label">
              {isPending ? 'Auto-rejection in' : isAwaitingCheckin ? 'Check-in deadline in' : 'Time remaining'}
            </span>
            <CountdownTimer
              targetDate={
                isPending ? booking.approvalDeadlineAt :
                isAwaitingCheckin ? booking.checkInDeadlineAt :
                booking.expiresAt
              }
            />
          </div>
        )}
      </div>

      {booking.groupMembers && booking.groupMembers.length > 0 && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <span className="label" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-sm)' }}>
            Group Members
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            {booking.groupMembers.map((member, i) => (
              <span key={i} style={{ fontSize: 'var(--font-size-sm)', background: 'var(--color-bg)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                {member.name} ({member.enrollmentNumber})
              </span>
            ))}
          </div>
        </div>
      )}

      {isPending && (
        <div className="banner-actions">
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onCancel(booking._id)}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Request'}
          </button>
        </div>
      )}

      {(isApproved || isAwaitingCheckin) && (
        <div className="banner-actions">
          <button
            className="btn btn-danger btn-sm"
            onClick={() => setConfirmCancel(true)}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Booking'}
          </button>
        </div>
      )}

      {confirmCancel && (
        <ConfirmDialog
          title="Cancel Booking"
          message="Are you sure you want to cancel this booking? The slot will be immediately freed up for others."
          confirmLabel="Cancel Booking"
          confirmClass="btn-danger"
          onConfirm={async () => {
            await onCancelApproved(booking._id);
            setConfirmCancel(false);
          }}
          onCancel={() => setConfirmCancel(false)}
        />
      )}
    </div>
  );
}
