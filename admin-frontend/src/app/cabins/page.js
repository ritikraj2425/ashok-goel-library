'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth';
import { getAdminCabins, updateCabin, createCabin, deleteCabin, getSystemSettings, updateWeeklySchedule, addException, removeException } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

export default function CabinsPage() {
  const { admin, loading: authLoading } = useAdminAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCabin, setNewCabin] = useState({ code: '', name: '', minPeople: 2, maxPeople: 6, isActive: true });

  const [cabins, setCabins] = useState([]);
  const [settings, setSettings] = useState(null);
  const [weeklySchedule, setWeeklySchedule] = useState({});
  const [exceptions, setExceptions] = useState([]);
  const [editingSettings, setEditingSettings] = useState(false);
  const [newException, setNewException] = useState({ date: '', startTime: '09:30', endTime: '21:30', slotDuration: 60, isClosed: false, label: '' });

  const fetchCabins = useCallback(async () => {
    try {
      const [cabinData, settingsData] = await Promise.all([
        getAdminCabins(),
        getSystemSettings(),
      ]);
      setCabins(cabinData.cabins || []);
      setSettings(settingsData.settings);
      setWeeklySchedule(settingsData.settings.weeklySchedule);
      setExceptions(settingsData.settings.exceptions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !admin) { router.push('/login'); return; }
    if (admin) fetchCabins();
  }, [admin, authLoading, router, fetchCabins]);

  const startEdit = (cabin) => {
    setEditingId(cabin._id);
    setEditData({ code: cabin.code, name: cabin.name, minPeople: cabin.minPeople, maxPeople: cabin.maxPeople, isActive: cabin.isActive });
  };

  const handleSave = async (id) => {
    setSaving(true);
    setError('');
    try {
      await updateCabin(id, editData);
      setEditingId(null);
      setSuccess('Cabin updated');
      fetchCabins();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createCabin(newCabin);
      setShowCreate(false);
      setNewCabin({ code: '', name: '', minPeople: 2, maxPeople: 6, isActive: true });
      setSuccess('Cabin created');
      fetchCabins();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this cabin? This cannot be undone.')) return;
    setSaving(true);
    setError('');
    try {
      await deleteCabin(id);
      setSuccess('Cabin deleted');
      fetchCabins();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setError('');

    for (const [day, config] of Object.entries(weeklySchedule)) {
      if (!config.isClosed && config.endTime <= config.startTime) {
        setError(`${day.charAt(0).toUpperCase() + day.slice(1)}: End time must be after start time (cross-midnight schedules are not allowed).`);
        setSaving(false);
        return;
      }
    }

    try {
      await updateWeeklySchedule(weeklySchedule);
      setSuccess('Weekly schedule updated');
      fetchCabins();
      setEditingSettings(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddException = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    if (!newException.isClosed && newException.endTime <= newException.startTime) {
      setError('Exception: End time must be after start time (cross-midnight schedules are not allowed).');
      setSaving(false);
      return;
    }

    try {
      await addException(newException);
      setSuccess('Date exception added');
      fetchCabins();
      setNewException({ date: '', startTime: '09:30', endTime: '21:30', slotDuration: 60, isClosed: false, label: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveException = async (id) => {
    setSaving(true);
    setError('');
    try {
      await removeException(id);
      setSuccess('Date exception removed');
      fetchCabins();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <h1 className="page-title">Cabin Management</h1>
          {admin?.role === 'root' && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? 'Cancel' : 'Add Cabin'}
            </button>
          )}
        </div>
        <p className="page-subtitle">Configure cabin settings and availability.</p>

        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {showCreate && (
          <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>New Cabin</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
                <div className="form-group"><label className="form-label">Code</label><input className="form-input" value={newCabin.code} onChange={(e) => setNewCabin(p => ({...p, code: e.target.value}))} required /></div>
                <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={newCabin.name} onChange={(e) => setNewCabin(p => ({...p, name: e.target.value}))} required /></div>
                <div className="form-group"><label className="form-label">Min People</label><input className="form-input" type="number" min="1" value={newCabin.minPeople === '' ? '' : newCabin.minPeople} onChange={(e) => setNewCabin(p => ({...p, minPeople: e.target.value === '' ? '' : parseInt(e.target.value)}))} required /></div>
                <div className="form-group"><label className="form-label">Max People</label><input className="form-input" type="number" min="1" value={newCabin.maxPeople === '' ? '' : newCabin.maxPeople} onChange={(e) => setNewCabin(p => ({...p, maxPeople: e.target.value === '' ? '' : parseInt(e.target.value)}))} required /></div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Creating...' : 'Create Cabin'}</button>
            </form>
          </div>
        )}

        <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Global Slot Settings</h2>
            {admin?.role === 'root' && (
              <button className="btn btn-primary btn-sm" onClick={() => editingSettings ? handleSaveSettings() : setEditingSettings(true)}>
                {editingSettings ? 'Save Settings' : 'Edit Weekly Schedule'}
              </button>
            )}
          </div>
          
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>Weekly Schedule</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
              <div key={day} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{day}</span>
                  <label className="toggle">
                    <input 
                      type="checkbox" 
                      checked={!weeklySchedule[day]?.isClosed} 
                      onChange={(e) => setWeeklySchedule(prev => ({...prev, [day]: {...prev[day], isClosed: !e.target.checked}}))} 
                      disabled={!editingSettings}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                {!weeklySchedule[day]?.isClosed ? (
                  <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="time" className="form-input" style={{ padding: '2px 4px' }} value={weeklySchedule[day]?.startTime || '09:30'} onChange={(e) => setWeeklySchedule(prev => ({...prev, [day]: {...prev[day], startTime: e.target.value}}))} disabled={!editingSettings} />
                    <span>-</span>
                    <input type="time" className="form-input" style={{ padding: '2px 4px' }} value={weeklySchedule[day]?.endTime || '21:30'} onChange={(e) => setWeeklySchedule(prev => ({...prev, [day]: {...prev[day], endTime: e.target.value}}))} disabled={!editingSettings} />
                    <input type="number" className="form-input" style={{ width: '60px', padding: '2px 4px' }} value={weeklySchedule[day]?.slotDuration === '' ? '' : (weeklySchedule[day]?.slotDuration ?? 60)} onChange={(e) => setWeeklySchedule(prev => ({...prev, [day]: {...prev[day], slotDuration: e.target.value === '' ? '' : parseInt(e.target.value)}}))} disabled={!editingSettings} /> <span style={{ fontSize: '12px' }}>m</span>
                  </div>
                ) : (
                  <div style={{ color: 'var(--color-error)' }}>Closed</div>
                )}
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>Date Exceptions (Overrides)</h3>
          {exceptions.length > 0 && (
            <table className="data-table" style={{ marginBottom: 'var(--space-md)' }}>
              <thead><tr><th>Date</th><th>Label</th><th>Status</th><th>Hours</th><th>Duration</th><th>Action</th></tr></thead>
              <tbody>
                {exceptions.map(exc => (
                  <tr key={exc._id}>
                    <td>{exc.date}</td>
                    <td>{exc.label || '-'}</td>
                    <td><span className={`badge ${exc.isClosed ? 'badge-inactive' : 'badge-available'}`}>{exc.isClosed ? 'Closed' : 'Open'}</span></td>
                    <td>{exc.isClosed ? '-' : `${exc.startTime} - ${exc.endTime}`}</td>
                    <td>{exc.isClosed ? '-' : `${exc.slotDuration} min`}</td>
                    <td>
                      {admin?.role === 'root' && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-color)' }} onClick={() => handleRemoveException(exc._id)}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {admin?.role === 'root' && (
            <form onSubmit={handleAddException} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--color-bg-secondary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Date</label><input type="date" className="form-input" value={newException.date} onChange={e => setNewException(p => ({...p, date: e.target.value}))} required /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Label</label><input type="text" className="form-input" placeholder="e.g. Holiday" value={newException.label} onChange={e => setNewException(p => ({...p, label: e.target.value}))} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
                  <input type="checkbox" checked={newException.isClosed} onChange={e => setNewException(p => ({...p, isClosed: e.target.checked}))} /> Closed
                </label>
              </div>
              {!newException.isClosed && (
                <>
                  <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Start</label><input type="time" className="form-input" value={newException.startTime} onChange={e => setNewException(p => ({...p, startTime: e.target.value}))} required /></div>
                  <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">End</label><input type="time" className="form-input" value={newException.endTime} onChange={e => setNewException(p => ({...p, endTime: e.target.value}))} required /></div>
                  <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Duration (m)</label><input type="number" className="form-input" value={newException.slotDuration === '' ? '' : newException.slotDuration} onChange={e => setNewException(p => ({...p, slotDuration: e.target.value === '' ? '' : parseInt(e.target.value)}))} style={{ width: '80px' }} required /></div>
                </>
              )}
              <button type="submit" className="btn btn-secondary btn-sm">Add Exception</button>
            </form>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Cabins</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Min</th>
                <th>Max</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cabins.map((cabin) => (
                <tr key={cabin._id}>
                  {editingId === cabin._id ? (
                    <>
                      <td><input className="inline-input" value={editData.code} onChange={(e) => setEditData(p => ({...p, code: e.target.value}))} /></td>
                      <td><input className="inline-input" value={editData.name} onChange={(e) => setEditData(p => ({...p, name: e.target.value}))} /></td>
                      <td><input className="inline-input" type="number" min="1" value={editData.minPeople === '' ? '' : editData.minPeople} onChange={(e) => setEditData(p => ({...p, minPeople: e.target.value === '' ? '' : parseInt(e.target.value)}))} style={{width:60}} /></td>
                      <td><input className="inline-input" type="number" min="1" value={editData.maxPeople === '' ? '' : editData.maxPeople} onChange={(e) => setEditData(p => ({...p, maxPeople: e.target.value === '' ? '' : parseInt(e.target.value)}))} style={{width:60}} /></td>
                      <td>
                        <label className="toggle">
                          <input type="checkbox" checked={editData.isActive} onChange={(e) => setEditData(p => ({...p, isActive: e.target.checked}))} />
                          <span className="toggle-slider"></span>
                        </label>
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:'var(--space-xs)' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => handleSave(cabin._id)} disabled={saving}>{saving ? '...' : 'Save'}</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><strong>{cabin.code}</strong></td>
                      <td>{cabin.name}</td>
                      <td>{cabin.minPeople}</td>
                      <td>{cabin.maxPeople}</td>
                      <td><span className={`badge ${cabin.isActive ? 'badge-available' : 'badge-inactive'}`}>{cabin.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(cabin)}>Edit</button>
                          {admin?.role === 'root' && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-color)' }} onClick={() => handleDelete(cabin._id)} disabled={saving}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
