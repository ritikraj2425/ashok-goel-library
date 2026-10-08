'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import StatusBadge from './StatusBadge';
import CountdownTimer from './CountdownTimer';
import ConfirmDialog from './ConfirmDialog';
import { getJoinStatus, cancelPendingMembers as apiCancelPendingMembers } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/lib/auth';

export default function ActiveBookingBanner({ booking, onCancel, cancelling, onCancelApproved }) {
  const { user } = useAuth();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!booking) return null;

  const isHost = user && (String(booking.studentUserId) === String(user.id) || String(booking.studentUserId?._id) === String(user.id));

  const isPending = booking.status === 'pending';
  const isPendingMembers = booking.status === 'pending_members';
  const isApproved = booking.status === 'approved';
  const isCancelRequested = booking.status === 'cancel_requested';
  const isAwaitingCheckin = booking.status === 'awaiting_checkin';
  const isCheckedIn = booking.status === 'checked_in';
  const cabinName = booking.cabinId?.name || booking.cabinId?.code || 'Cabin';
  const now = new Date();
  const hasStarted = booking.startTime && new Date(booking.startTime) <= now;

  const [joinStatus, setJoinStatus] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [cancellingGroup, setCancellingGroup] = useState(false);
  const pollRef = useRef(null);

  const joinUrl = isPendingMembers && booking.joinToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${booking.joinToken}`
    : '';

  // Poll join status for pending_members bookings
  const pollStatus = useCallback(async () => {
    if (!isPendingMembers) return;
    try {
      const status = await getJoinStatus(booking._id);
      setJoinStatus(status);
      if (status.status !== 'pending_members') {
        clearInterval(pollRef.current);
      }
    } catch (e) { /* ignore */ }
  }, [booking._id, isPendingMembers]);

  useEffect(() => {
    if (!isPendingMembers) return;
    pollStatus();
    pollRef.current = setInterval(pollStatus, 10000);
    return () => clearInterval(pollRef.current);
  }, [isPendingMembers, pollStatus]);

  let title = 'Your Active Booking';
  if (isPending) title = 'Your Pending Request';
  else if (isPendingMembers) title = 'Waiting for Group Members';
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
        {isPending ? (
          <div className="booking-detail">
            <span className="label">Auto-rejection in</span>
            <CountdownTimer targetDate={booking.approvalDeadlineAt} />
          </div>
        ) : isPendingMembers ? (
          <div className="booking-detail">
            <span className="label">Invite expires in</span>
            <CountdownTimer targetDate={booking.joinExpiresAt} />
          </div>
        ) : isAwaitingCheckin ? (
          <div className="booking-detail">
            <span className="label">Check-in deadline</span>
            <CountdownTimer targetDate={booking.checkInDeadlineAt} />
          </div>
        ) : isCheckedIn ? (
          <div className="booking-detail">
            <span className="label">Session ends in</span>
            <CountdownTimer targetDate={booking.expiresAt} />
          </div>
        ) : isApproved && !hasStarted ? (
          <div className="booking-detail">
            <span className="label">Starts at</span>
            <span>{new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ) : isApproved && hasStarted ? (
          <div className="booking-detail">
            <span className="label">Check-in deadline</span>
            <CountdownTimer targetDate={booking.checkInDeadlineAt} />
          </div>
        ) : (
          <div className="booking-detail">
            <span className="label">Time remaining</span>
            <CountdownTimer targetDate={booking.expiresAt} />
          </div>
        )}
      </div>

      {(isApproved || isAwaitingCheckin) && (
        <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-sm)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
          <strong style={{ color: 'var(--color-error)' }}>Important:</strong> Student must ask the librarian for check-in within 10 mins from the time the time slot starts.
        </div>
      )}

      {/* Joined members (new flow) */}
      {booking.joinedMembers && booking.joinedMembers.length > 0 && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <span className="label" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-sm)' }}>
            Joined Members ({booking.joinedMembers.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            {booking.joinedMembers.map((member, i) => (
              <span key={i} style={{ fontSize: 'var(--font-size-sm)', background: 'var(--color-bg)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                {member.name} ({member.email})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pending Members Group Status for Everyone */}
      {isPendingMembers && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <div className="alert alert-warning" style={{ fontSize: 'var(--font-size-sm)' }}>
            <strong>Waiting for group members:</strong> {(joinStatus?.joinedCount ?? (booking.joinedMembers?.length || 0)) + 1} / {booking.peopleCount} members are ready (including the host). The booking will automatically be approved once all members join.
          </div>
        </div>
      )}

      {/* Pending Members: Show QR / link / cancel */}
      {isPendingMembers && isHost && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowQR(!showQR)}>
              {showQR ? 'Hide Invite' : 'Show Invite QR / Link'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={async () => {
                setCancellingGroup(true);
                try {
                  await apiCancelPendingMembers(booking._id);
                  onCancel(booking._id);
                } catch (e) { /* handled by parent */ }
                setCancellingGroup(false);
              }}
              disabled={cancellingGroup}
            >
              {cancellingGroup ? 'Cancelling...' : 'Cancel Group Booking'}
            </button>
          </div>

          {showQR && joinUrl && (
            <div style={{ textAlign: 'center', padding: 'var(--space-md)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'inline-block', background: '#fff', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-md)' }}>
                <QRCodeSVG value={joinUrl} size={160} level="M" />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'stretch' }}>
                <input type="text" className="form-input" value={joinUrl} readOnly style={{ flex: 1, fontSize: 'var(--font-size-sm)' }} onClick={(e) => e.target.select()} />
                <button className={`btn ${linkCopied ? 'btn-success' : 'btn-primary'} btn-sm`} onClick={() => { navigator.clipboard.writeText(joinUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}>
                  {linkCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isPending && isHost && (
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

      {(isApproved || isAwaitingCheckin) && !hasStarted && isHost && (
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
          message="Are you sure you want to cancel this booking? Note: Your daily slot quota will be returned to you, but cancelling an approved booking counts towards your weekly cancellation limit (max 3 per week before a penalty is applied)."
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
