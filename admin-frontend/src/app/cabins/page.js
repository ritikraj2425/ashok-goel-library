'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth';
import { getAdminCabins, updateCabin, createCabin, deleteCabin } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

export default function CabinsPage() {
  const { admin, loading: authLoading } = useAdminAuth();
  const router = useRouter();

  const [cabins, setCabins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCabin, setNewCabin] = useState({ code: '', name: '', minPeople: 2, maxPeople: 6, isActive: true });

  const fetchCabins = useCallback(async () => {
    try {
      const data = await getAdminCabins();
      setCabins(data.cabins || []);
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
                <div className="form-group"><label className="form-label">Min People</label><input className="form-input" type="number" min="1" value={newCabin.minPeople} onChange={(e) => setNewCabin(p => ({...p, minPeople: parseInt(e.target.value)}))} required /></div>
                <div className="form-group"><label className="form-label">Max People</label><input className="form-input" type="number" min="1" value={newCabin.maxPeople} onChange={(e) => setNewCabin(p => ({...p, maxPeople: parseInt(e.target.value)}))} required /></div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Creating...' : 'Create Cabin'}</button>
            </form>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                      <td><input className="inline-input" type="number" min="1" value={editData.minPeople} onChange={(e) => setEditData(p => ({...p, minPeople: parseInt(e.target.value)}))} style={{width:60}} /></td>
                      <td><input className="inline-input" type="number" min="1" value={editData.maxPeople} onChange={(e) => setEditData(p => ({...p, maxPeople: parseInt(e.target.value)}))} style={{width:60}} /></td>
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
