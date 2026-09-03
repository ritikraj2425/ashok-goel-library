'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { updateProfile } from '@/lib/api';
import Header from '@/components/Header';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ProfilePage() {
  const { user, loading: authLoading, login } = useAuth();
  const [formData, setFormData] = useState({
    phoneNumber: '',
    enrollmentNumber: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        phoneNumber: user.phoneNumber || '',
        enrollmentNumber: user.enrollmentNumber || '',
      });
    }
  }, [user]);

  if (authLoading) {
    return (
      <>
        <Header />
        <LoadingSpinner />
      </>
    );
  }

  if (!user) {
    return null; // Will be redirected by useAuth or router
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const data = await updateProfile(formData);
      login(data.user);
      setSuccess('Profile updated successfully! This information will now pre-fill your cabin bookings.');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header />
      <main className="page-container" style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--space-2xl) var(--space-xl)' }}>
        <h2 className="page-title">My Profile</h2>
        <p className="page-subtitle">Set your details here so they automatically fill in when you book a cabin.</p>

        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                type="text" 
                className="form-input" 
                value={user.name} 
                disabled 
                style={{ backgroundColor: 'var(--color-bg-hover)' }}
              />
              <small style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>Name is synced from your Google account.</small>
            </div>
            
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                type="text" 
                className="form-input" 
                value={user.email} 
                disabled 
                style={{ backgroundColor: 'var(--color-bg-hover)' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Enrollment Number (Optional)</label>
              <input 
                type="text" 
                className="form-input" 
                value={formData.enrollmentNumber} 
                onChange={(e) => setFormData(prev => ({ ...prev, enrollmentNumber: e.target.value }))}
                placeholder="e.g. 123456"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number (Optional)</label>
              <input 
                type="tel" 
                className="form-input" 
                value={formData.phoneNumber} 
                onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="10-digit mobile number"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-md)' }} disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile Details'}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
