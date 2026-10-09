'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { createBookingRequest, getJoinStatus, cancelPendingMembers } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

const JOIN_POLL_INTERVAL = 10000; // 10 seconds

export default function BookingModal({ cabin, onClose, onSuccess, remainingSlots = 2 }) {
  const { user } = useAuth();

  const [userType, setUserType] = useState('student');
  const [slotCount, setSlotCount] = useState(1);
  const [formData, setFormData] = useState({
    mainStudentName: user?.name || '',
    mainStudentPhone: user?.phoneNumber || '',
    peopleCount: cabin.maxPeople,
    timeSlotId: cabin.availableSlots && cabin.availableSlots.length > 0 ? cabin.availableSlots[0].id : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Group joining state
  const [pendingBooking, setPendingBooking] = useState(null);
  const [joinStatus, setJoinStatus] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const pollRef = useRef(null);
  const countdownRef = useRef(null);

  // Generate consecutive slot pairs from available slots
  const consecutiveSlotPairs = useMemo(() => {
    if (!cabin.availableSlots || cabin.availableSlots.length < 2) return [];
    const slots = cabin.availableSlots;
    const pairs = [];
    for (let i = 0; i < slots.length - 1; i++) {
      if (slots[i].endHour === slots[i + 1].startHour && slots[i].endMin === slots[i + 1].startMin) {
        pairs.push({
          id: `${slots[i].id}+${slots[i + 1].id}`,
          slot1: slots[i],
          slot2: slots[i + 1],
          label: `${slots[i].label.split(' - ')[0]} - ${slots[i + 1].label.split(' - ')[1]}`,
        });
      }
    }
    return pairs;
  }, [cabin.availableSlots]);

  // When slotCount changes, reset the selected slot
  useEffect(() => {
    if (slotCount === 1) {
      setFormData(prev => ({
        ...prev,
        timeSlotId: cabin.availableSlots && cabin.availableSlots.length > 0 ? cabin.availableSlots[0].id : '',
      }));
    } else if (slotCount === 2) {
      setFormData(prev => ({
        ...prev,
        timeSlotId: consecutiveSlotPairs.length > 0 ? consecutiveSlotPairs[0].id : '',
      }));
    }
  }, [slotCount, cabin.availableSlots, consecutiveSlotPairs]);

  const joinUrl = useMemo(() => {
    if (!pendingBooking?.joinToken) return '';
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/join/${pendingBooking.joinToken}`;
  }, [pendingBooking]);

  // Countdown timer
  useEffect(() => {
    if (!pendingBooking?.joinExpiresAt) return;

    const updateCountdown = () => {
      const remaining = Math.max(0, new Date(pendingBooking.joinExpiresAt).getTime() - Date.now());
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        clearInterval(pollRef.current);
      }
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
    return () => clearInterval(countdownRef.current);
  }, [pendingBooking]);

  // Polling for join status
  const pollJoinStatus = useCallback(async () => {
    if (!pendingBooking?._id) return;
    try {
      const status = await getJoinStatus(pendingBooking._id);
      setJoinStatus(status);
      if (status.status === 'approved') {
        clearInterval(pollRef.current);
        clearInterval(countdownRef.current);
        // Auto-close after brief celebration
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else if (status.status !== 'pending_members') {
        // Expired or cancelled
        clearInterval(pollRef.current);
        clearInterval(countdownRef.current);
      }
    } catch (err) {
      // Ignore polling errors
    }
  }, [pendingBooking, onSuccess]);

  useEffect(() => {
    if (!pendingBooking) return;
    pollJoinStatus(); // initial fetch
    pollRef.current = setInterval(pollJoinStatus, JOIN_POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [pendingBooking, pollJoinStatus]);

  const handlePeopleCountChange = (e) => {
    const count = parseInt(e.target.value, 10);
    setFormData((prev) => ({ ...prev, peopleCount: count }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const nameRegex = /^[a-zA-Z\s\.\-']+$/;
      const phoneRegex = /^[0-9]{10}$/;
      const mainName = formData.mainStudentName.trim();
      const mainPhone = formData.mainStudentPhone.trim();

      if (!nameRegex.test(mainName)) throw new Error('Name should only contain letters.');
      if (!phoneRegex.test(mainPhone)) throw new Error('Phone must be exactly 10 digits.');
      if (!formData.timeSlotId) throw new Error('Please select a valid time slot.');

      const requestBody = {
        cabinId: cabin.id,
        userType,
        mainStudent: {
          name: formData.mainStudentName.trim(),
          phoneNumber: formData.mainStudentPhone.trim(),
        },
        groupMembers: [],
        peopleCount: userType === 'student' ? formData.peopleCount : 1,
        slotCount,
      };

      if (slotCount === 2) {
        const [slot1Id, slot2Id] = formData.timeSlotId.split('+');
        requestBody.timeSlotId = slot1Id;
        requestBody.timeSlotIds = [slot1Id, slot2Id];
      } else {
        requestBody.timeSlotId = formData.timeSlotId;
        requestBody.timeSlotIds = [formData.timeSlotId];
      }

      const result = await createBookingRequest(requestBody);
      const booking = result.booking;

      if (booking.status === 'pending_members') {
        // Group booking: show QR code / link
        setPendingBooking(booking);
      } else {
        // Solo/faculty booking: submitted for approval
        onSuccess();
      }
    } catch (err) {
      setError(err.message || 'Failed to create booking request');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPending = async () => {
    if (!pendingBooking?._id) return;
    setCancelling(true);
    try {
      await cancelPendingMembers(pendingBooking._id);
      clearInterval(pollRef.current);
      clearInterval(countdownRef.current);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const formatCountdown = (ms) => {
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const countOptions = [];
  for (let i = cabin.minPeople; i <= cabin.maxPeople; i++) {
    countOptions.push(i);
  }

  // If we have a pending booking, show the waiting room
  if (pendingBooking) {
    const isApproved = joinStatus?.status === 'approved';
    const isExpired = countdown !== null && countdown <= 0 && !isApproved;
    const joinedCount = joinStatus?.joinedCount ?? 0;
    const totalNeeded = joinStatus?.totalNeeded ?? (pendingBooking.peopleCount - 1);

    return (
      <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
          <div className="modal-header">
            <h2>{isApproved ? ' Booking Confirmed!' : isExpired ? '⏰ Invite Expired' : 'Waiting for Members'}</h2>
            <button className="btn btn-ghost" onClick={() => {
              clearInterval(pollRef.current);
              clearInterval(countdownRef.current);
              onClose();
            }}>Close</button>
          </div>

          <div className="modal-body" style={{ textAlign: 'center' }}>
            {isApproved ? (
              <div>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}></div>
                <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-success)' }}>
                  All members joined! Your cabin is booked.
                </p>
                <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)' }}>
                  Redirecting to dashboard...
                </p>
              </div>
            ) : isExpired ? (
              <div>
                <p style={{ color: 'var(--color-error)', fontWeight: 600 }}>
                  The 10-minute window has expired. Only {joinedCount} of {totalNeeded} members joined.
                </p>
                <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)' }}>
                  The slot has been released. You can try booking again.
                </p>
                <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={onClose}>
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Countdown */}
                <div style={{
                  background: countdown < 60000 ? 'var(--color-error-bg, #fef2f2)' : 'var(--color-bg)',
                  border: `2px solid ${countdown < 60000 ? 'var(--color-error)' : 'var(--color-primary)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  marginBottom: 'var(--space-lg)',
                }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Time Remaining</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: countdown < 60000 ? 'var(--color-error)' : 'var(--color-primary)' }}>
                    {countdown !== null ? formatCountdown(countdown) : '--:--'}
                  </div>
                </div>

                {/* Progress */}
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
                    {joinedCount} / {totalNeeded} members joined
                  </div>
                  <div style={{ height: '8px', background: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${totalNeeded > 0 ? (joinedCount / totalNeeded) * 100 : 0}%`,
                      background: 'var(--color-primary)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>

                {/* Joined members list */}
                {joinStatus?.joinedMembers?.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-lg)', textAlign: 'left' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>Joined:</div>
                    {joinStatus.joinedMembers.map((m, i) => (
                      <div key={i} style={{
                        padding: 'var(--space-xs) var(--space-sm)',
                        background: 'var(--color-bg)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: 'var(--space-xs)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-sm)',
                      }}>
                        <span style={{ color: 'var(--color-success)' }}></span>
                        <span>{m.name}</span>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{m.email}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* QR Code */}
                <div style={{
                  background: '#fff',
                  display: 'inline-block',
                  padding: 'var(--space-md)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  marginBottom: 'var(--space-md)',
                }}>
                  <QRCodeSVG value={joinUrl} size={200} level="M" />
                </div>

                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                  Ask your group members to scan this QR code or use the link below to join.
                </p>

                {/* Copy link */}
                <div style={{
                  display: 'flex',
                  gap: 'var(--space-sm)',
                  alignItems: 'stretch',
                  marginBottom: 'var(--space-md)'
                }}>
                  <input
                    type="text"
                    className="form-input"
                    value={joinUrl}
                    readOnly
                    style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    className={`btn ${linkCopied ? 'btn-success' : 'btn-primary'}`}
                    onClick={handleCopyLink}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {linkCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                  <button
                    className="btn btn-danger"
                    style={{ width: '100%' }}
                    onClick={handleCancelPending}
                    disabled={cancelling}
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Book {cabin.name}</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label">User Type <span className="required">*</span></label>
              <div style={{ display: 'flex', gap: 'var(--space-lg)', marginTop: 'var(--space-xs)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer' }}>
                  <input type="radio" name="userType" value="student" checked={userType === 'student'} onChange={() => setUserType('student')} />
                  <span>Student</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer' }}>
                  <input type="radio" name="userType" value="faculty" checked={userType === 'faculty'} onChange={() => setUserType('faculty')} />
                  <span>Faculty</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Duration <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={slotCount}
                onChange={(e) => setSlotCount(parseInt(e.target.value, 10))}
              >
                <option value={1}>1 Slot</option>
                <option value={2} disabled={remainingSlots < 2 || consecutiveSlotPairs.length === 0}>
                  2 Consecutive Slots {remainingSlots < 2 ? '(quota used)' : consecutiveSlotPairs.length === 0 ? '(no pairs available)' : ''}
                </option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Time Slot (Today) <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={formData.timeSlotId}
                onChange={(e) => setFormData((prev) => ({ ...prev, timeSlotId: e.target.value }))}
                required
              >
                {slotCount === 1 ? (
                  (cabin.availableSlots?.length > 0 || cabin.holdSlots?.length > 0) ? (
                    <>
                      {cabin.availableSlots?.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {slot.label}
                        </option>
                      ))}
                      {cabin.holdSlots?.map((slot) => (
                        <option key={slot.id} value={slot.id} disabled>
                          {slot.label} (On Hold)
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="" disabled>No slots available</option>
                  )
                ) : (
                  consecutiveSlotPairs.length > 0 ? (
                    consecutiveSlotPairs.map((pair) => (
                      <option key={pair.id} value={pair.id}>
                        {pair.label}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No consecutive slot pairs available</option>
                  )
                )}
              </select>
            </div>

            {userType === 'student' && (
              <div className="form-group">
                <label className="form-label">
                  People Count <span className="required">*</span>
                </label>
                <select
                  className="form-select"
                  value={formData.peopleCount}
                  onChange={handlePeopleCountChange}
                >
                  {countOptions.map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'person' : 'people'}
                    </option>
                  ))}
                </select>
                {formData.peopleCount > 1 && (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>
                    After booking, a QR code and link will be generated. Your {formData.peopleCount - 1} group member(s) must scan/click to join within 10 minutes.
                  </p>
                )}
              </div>
            )}

            <div style={{ marginBottom: userType === 'student' ? 'var(--space-lg)' : 0 }}>
              <span className="form-label" style={{ display: 'block', marginBottom: 'var(--space-md)', fontWeight: 600 }}>
                {userType === 'student' ? 'Your Details (Booking Owner)' : 'Faculty Details'}
              </span>
              <div className="form-group">
                <label className="form-label">Full Name <span className="required">*</span></label>
                <input type="text" className="form-input" value={formData.mainStudentName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, mainStudentName: e.target.value }))}
                  placeholder="Enter full name" required />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number <span className="required">*</span></label>
                <input type="tel" className="form-input" value={formData.mainStudentPhone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, mainStudentPhone: e.target.value }))}
                  placeholder="Enter phone number" required />
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Submitting...' :
                  userType === 'student' && formData.peopleCount > 1
                    ? `Generate Invite Link (${formData.peopleCount} people)`
                    : slotCount === 2 ? 'Submit 2-Slot Booking' : 'Submit Booking Request'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
