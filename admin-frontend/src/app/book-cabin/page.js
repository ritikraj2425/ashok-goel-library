'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth';
import { getCabinStatusForAdmin, createAdminBooking } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

export default function BookCabinPage() {
  const { admin, loading: authLoading } = useAdminAuth();
  const router = useRouter();

  const [cabins, setCabins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bookingLocked, setBookingLocked] = useState(false);
  const [bookingUnlockTime, setBookingUnlockTime] = useState(null);
  
  const [selectedCabinId, setSelectedCabinId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [bookingInProgress, setBookingInProgress] = useState(false);

  useEffect(() => {
    if (!authLoading && !admin) {
      router.push('/login');
      return;
    }
    if (admin) {
      fetchCabinStatus();
    }
  }, [admin, authLoading, router]);

  const fetchCabinStatus = async () => {
    try {
      const data = await getCabinStatusForAdmin();
      setCabins(data.cabins || []);
      setBookingLocked(data.bookingsLocked || false);
      setBookingUnlockTime(data.bookingUnlockTime || null);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load cabin status');
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!selectedCabinId || !selectedSlotId) {
      setError('Please select both a cabin and a time slot');
      return;
    }
    setBookingInProgress(true);
    setError('');
    setSuccess('');
    try {
      await createAdminBooking({
        cabinId: selectedCabinId,
        timeSlotId: selectedSlotId,
      });
      setSuccess('Cabin successfully booked!');
      setSelectedCabinId('');
      setSelectedSlotId('');
      fetchCabinStatus();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to book cabin');
    } finally {
      setBookingInProgress(false);
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

  const selectedCabin = cabins.find(c => c.id === selectedCabinId);
  const availableSlots = selectedCabin ? selectedCabin.availableSlots : [];

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <h1 className="page-title">Book Cabin</h1>
        </div>
        <p className="page-subtitle">Reserve a cabin for administration purposes. These bookings bypass student limits and are automatically approved.</p>

        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {bookingLocked && (
          <div className="alert alert-error">
            <strong>Bookings Locked:</strong>{' '}
            {bookingUnlockTime
              ? `The library schedule indicates bookings open at ${new Date(bookingUnlockTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}.`
              : 'The library is closed today.'}
          </div>
        )}

        <div className="card" style={{ maxWidth: '600px', marginTop: 'var(--space-xl)' }}>
          <form onSubmit={handleBook}>
            <div className="form-group">
              <label className="form-label">Select Cabin</label>
              <select 
                className="form-select" 
                value={selectedCabinId} 
                onChange={(e) => {
                  setSelectedCabinId(e.target.value);
                  setSelectedSlotId('');
                }}
                disabled={bookingLocked || cabins.length === 0}
                required
              >
                <option value="">-- Choose a cabin --</option>
                {cabins.map(cabin => (
                  <option key={cabin.id} value={cabin.id}>
                    {cabin.name} (Code: {cabin.code}) - {cabin.availableSlots?.length || 0} slots available
                  </option>
                ))}
              </select>
            </div>

            {selectedCabinId && (
              <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                <label className="form-label">Select Time Slot</label>
                <select 
                  className="form-select"
                  value={selectedSlotId}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                  disabled={availableSlots.length === 0}
                  required
                >
                  <option value="">
                    {availableSlots.length === 0 ? '-- No slots available --' : '-- Choose a time slot --'}
                  </option>
                  {availableSlots.map(slot => (
                    <option key={slot.id} value={slot.id}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ marginTop: 'var(--space-xl)', width: '100%' }}
              disabled={!selectedCabinId || !selectedSlotId || bookingInProgress}
            >
              {bookingInProgress ? 'Booking...' : 'Book Cabin'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
