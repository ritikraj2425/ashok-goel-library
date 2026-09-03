'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/auth';
import { getBlockedStudents, unblockStudent, blockStudent, searchStudents } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function BlockedStudentsPage() {
  const { admin, loading: authLoading } = useAdminAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [blockEmail, setBlockEmail] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const [confirm, setConfirm] = useState(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getBlockedStudents();
      setStudents(data.blockedStudents);
    } catch (err) {
      setError(err.message || 'Failed to fetch blocked students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) {
      fetchStudents();
    }
  }, [admin, fetchStudents]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleUnblock = (studentId, studentName) => {
    setConfirm({
      title: 'Unblock Student',
      message: `Are you sure you want to unblock ${studentName}? They will be able to book cabins immediately.`,
      confirmLabel: 'Unblock',
      confirmClass: 'btn-success',
      onConfirm: async () => {
        try {
          await unblockStudent(studentId);
          showSuccess(`${studentName} successfully unblocked`);
          setConfirm(null);
          fetchStudents();
        } catch (e) {
          alert(e.message || 'Failed to unblock student');
          setConfirm(null);
        }
      },
    });
  };

  const handleEmailChange = async (e) => {
    const val = e.target.value;
    setBlockEmail(val);
    if (val.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const data = await searchStudents(val);
      setSuggestions(data.students || []);
      setShowSuggestions(true);
    } catch (err) {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (email) => {
    setBlockEmail(email);
    setShowSuggestions(false);
  };

  const handleBlockSubmit = async (e) => {
    e.preventDefault();
    if (!blockEmail.trim()) return;
    setBlocking(true);
    setError('');
    try {
      await blockStudent(blockEmail.trim());
      showSuccess(`Successfully blocked student with email: ${blockEmail}`);
      setBlockEmail('');
      fetchStudents();
    } catch (err) {
      setError(err.message || 'Failed to block student');
    } finally {
      setBlocking(false);
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
        <h1 className="page-title">Blocked Students</h1>
        <p className="page-subtitle">Manage students who missed check-ins or were manually blocked.</p>

        <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
          <strong>Understanding Blocks:</strong>
          <ul style={{ marginLeft: 'var(--space-md)', marginTop: 'var(--space-xs)' }}>
            <li><strong>Temporarily Blocked:</strong> Students automatically penalized for 2 days due to missing their check-in deadline.</li>
            <li><strong>Permanently Blocked:</strong> Students manually banned by administrators. They cannot book cabins until manually unblocked.</li>
          </ul>
        </div>

        {success && <div className="alert alert-success" style={{ marginBottom: 'var(--space-md)' }}>{success}</div>}
        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

        <div className="dashboard-section card" style={{ marginBottom: 'var(--space-xl)' }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Manually Block a Student</h3>
          <form onSubmit={handleBlockSubmit} style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="email"
                className="form-control"
                placeholder="Student's Email (e.g., student@rishihood.edu.in)"
                value={blockEmail}
                onChange={handleEmailChange}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                required
                style={{ width: '100%' }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ 
                  position: 'absolute', top: '100%', left: 0, right: 0, 
                  background: 'var(--color-bg-card)', 
                  border: '1px solid var(--color-border)', 
                  borderRadius: 'var(--radius-md)', 
                  boxShadow: 'var(--shadow-md)', 
                  zIndex: 10, 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  marginTop: '4px'
                }}>
                  {suggestions.map((s) => (
                    <div 
                      key={s._id} 
                      onClick={() => handleSelectSuggestion(s.email)}
                      style={{ padding: 'var(--space-sm) var(--space-md)', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ fontWeight: 500 }}>{s.email}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{s.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" className="btn btn-danger" disabled={blocking} style={{ height: '38px' }}>
              {blocking ? 'Blocking...' : 'Block Student'}
            </button>
          </form>
        </div>

        <div className="dashboard-section">
          {students.length === 0 ? (
            <div className="empty-state">
              <p>No blocked students found.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'x-auto' }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Blocked Until</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const isTemp = student.blockedUntil && new Date(student.blockedUntil) > new Date();

                      return (
                        <tr key={student._id}>
                          <td>{student.name}</td>
                          <td>{student.email}</td>
                          <td>
                            <span className="badge badge-rejected">
                              {student.isBlocked ? 'Permanently Blocked' : 'Temporarily Blocked'}
                            </span>
                          </td>
                          <td>
                            {isTemp
                              ? new Date(student.blockedUntil).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                              : (student.isBlocked ? 'Indefinite' : '-')
                            }
                          </td>
                          <td>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleUnblock(student._id, student.name)}
                            >
                              Unblock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          confirmClass={confirm.confirmClass}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
