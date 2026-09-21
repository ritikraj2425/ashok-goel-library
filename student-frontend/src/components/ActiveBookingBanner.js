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

  const formatTimeSlot = (bookingObj) => {
    const slotStrs = bookingObj.timeSlotIds && bookingObj.timeSlotIds.length > 0 
      ? bookingObj.timeSlotIds 
      : [bookingObj.timeSlotId];
      
    const formatTime = (time24) => {
      const [h, m] = time24.split(':');
      if (!h || !m) return time24;
      const hour = parseInt(h, 10);
      const suffix = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${m} ${suffix}`;
    };

    if (slotStrs.length > 1) {
       const start = slotStrs[0].split('-')[0];
       const end = slotStrs[slotStrs.length - 1].split('-')[1];
       return `${formatTime(start.trim())} - ${formatTime(end.trim())}`;
    } else {
       const slotStr = slotStrs[0];
       if (!slotStr) return '';
       if (slotStr.includes('-')) {
         return slotStr.split('-').map(t => formatTime(t.trim())).join(' - ');
       }
       return formatTime(slotStr);
    }
  };

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
          {formatTimeSlot(booking)}
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

      {(isApproved || isAwaitingCheckin) && (
        <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 500, borderLeft: '3px solid var(--color-error)' }}>
          <strong style={{ color: 'var(--color-error)' }}>Important:</strong> Student must do check-in within 10 mins from the time the time slot starts.
        </div>
      )}

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

      {(isApproved || isAwaitingCheckin) && !hasStarted && (
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
          message="Are you sure you want to cancel this booking? WARNING: Since this booking has already been approved, cancelling it now will STILL count against your daily quota limit (2 slots max). You will NOT get this quota back for today."
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
