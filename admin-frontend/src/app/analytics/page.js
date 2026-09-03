'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth';
import { getAnalytics, getAnalyticsBookings, getBookingDetail } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

function formatDuration(ms) {
  if (!ms) return '-';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
}

const statusMap = {
  pending: { label: 'Pending', className: 'badge-pending' },
  approved: { label: 'Approved', className: 'badge-available' },

  awaiting_checkin: { label: 'Awaiting Check-in', className: 'badge-warning' },
  checked_in: { label: 'Checked In', className: 'badge-available' },
  no_show: { label: 'No Show', className: 'badge-rejected' },
  rejected: { label: 'Rejected', className: 'badge-rejected' },
  auto_rejected: { label: 'Auto-Rejected', className: 'badge-rejected' },
  cancelled_by_student: { label: 'Cancelled (Student)', className: 'badge-inactive' },
  cancelled_by_admin: { label: 'Cancelled (Admin)', className: 'badge-inactive' },
  completed: { label: 'Completed', className: 'badge-completed' },
};

export default function AnalyticsPage() {
  const { admin, loading: authLoading } = useAdminAuth();
  const router = useRouter();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('daily');

  const [statusBookings, setStatusBookings] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [loadingBookings, setLoadingBookings] = useState(false);
  
  const [detailBooking, setDetailBooking] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleBadgeClick = async (status, count) => {
    if (count === 0) return;
    setSelectedStatus(status);
    setLoadingBookings(true);
    try {
      const bookings = await getAnalyticsBookings({ period, status });
      setStatusBookings(bookings);
    } catch (e) {
      console.error(e);
      alert(e.message);
      setSelectedStatus(null);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleViewDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const b = await getBookingDetail(id);
      setDetailBooking(b.booking);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !admin) { router.push('/login'); return; }
  }, [admin, authLoading, router]);

  useEffect(() => {
    if (!admin) return;
    setLoading(true);
    getAnalytics({ period })
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [admin, period]);

  if (authLoading || loading) {
    return (
      <div className="admin-layout">
        <Sidebar />
        <main className="admin-content"><div className="loading-container"><div className="spinner" /></div></main>
      </div>
    );
  }

  if (!analytics) return null;

  const { counts, cabinUsage, popularSlots, averageApprovalTimeMs, averageOccupancyDurationMs, mostUsedCabin } = analytics;

  const maxPeakCount = Math.max(...(popularSlots || []).map(h => h.count), 1);

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Booking statistics and usage patterns.</p>

        <div className="filters">
          {['daily', 'weekly', 'monthly'].map((p) => (
            <button key={p} className={`filter-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Stat Cards */}
        <div className="stats-grid">
          <div className="card stat-card" style={{ cursor: counts.total > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('total', counts.total)}>
            <div className="stat-value">{counts.total}</div>
            <div className="stat-label">Total Requests</div>
          </div>
          <div className="card stat-card" style={{ cursor: counts.approved + counts.completed > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('approved', counts.approved + counts.completed)}>
            <div className="stat-value" style={{ color: 'var(--color-status-available)' }}>{counts.approved + counts.completed}</div>
            <div className="stat-label">Approved</div>
          </div>
          <div className="card stat-card" style={{ cursor: counts.rejected > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('rejected', counts.rejected)}>
            <div className="stat-value" style={{ color: 'var(--color-error)' }}>{counts.rejected}</div>
            <div className="stat-label">Rejected</div>
          </div>
          <div className="card stat-card" style={{ cursor: counts.auto_rejected > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('auto_rejected', counts.auto_rejected)}>
            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{counts.auto_rejected}</div>
            <div className="stat-label">Auto-Rejected</div>
          </div>
          <div className="card stat-card" style={{ cursor: counts.cancelled_by_student > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('cancelled_by_student', counts.cancelled_by_student)}>
            <div className="stat-value">{counts.cancelled_by_student}</div>
            <div className="stat-label">Student Cancelled</div>
          </div>
          <div className="card stat-card" style={{ cursor: counts.cancelled_by_admin > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('cancelled_by_admin', counts.cancelled_by_admin)}>
            <div className="stat-value">{counts.cancelled_by_admin}</div>
            <div className="stat-label">Admin Checkout</div>
          </div>
          <div className="card stat-card" style={{ cursor: counts.completed > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('completed', counts.completed)}>
            <div className="stat-value">{counts.completed}</div>
            <div className="stat-label">Completed</div>
          </div>

          <div className="card stat-card" style={{ cursor: counts.awaiting_checkin > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('awaiting_checkin', counts.awaiting_checkin)}>
            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{counts.awaiting_checkin}</div>
            <div className="stat-label">Missed Check-ins</div>
          </div>
          <div className="card stat-card" style={{ cursor: counts.no_show > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('no_show', counts.no_show)}>
            <div className="stat-value" style={{ color: 'var(--color-error)' }}>{counts.no_show}</div>
            <div className="stat-label">No Shows</div>
          </div>
          <div className="card stat-card" style={{ cursor: counts.pending > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('pending', counts.pending)}>
            <div className="stat-value">{counts.pending}</div>
            <div className="stat-label">Currently Pending</div>
          </div>
        </div>

        {/* Key Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-2xl)' }}>
          <div className="card">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)' }}>Average Approval Time</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>{formatDuration(averageApprovalTimeMs)}</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)' }}>Avg Occupancy Duration</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>{formatDuration(averageOccupancyDurationMs)}</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)' }}>Most Used Cabin</div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>{mostUsedCabin ? `${mostUsedCabin.cabinName} (${mostUsedCabin.bookingCount})` : '-'}</div>
          </div>
        </div>

        {/* Cabin-wise Usage */}
        {cabinUsage.length > 0 && (
          <div className="dashboard-section">
            <h3 className="section-title">Cabin-wise Usage</h3>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cabin</th>
                    <th>Bookings</th>
                    <th>Total People</th>
                  </tr>
                </thead>
                <tbody>
                  {cabinUsage.map((cu) => (
                    <tr key={cu._id}>
                      <td><strong>{cu.cabinName}</strong> <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>({cu.cabinCode})</span></td>
                      <td>{cu.bookingCount}</td>
                      <td>{cu.totalPeople}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Popular Slots */}
        <div className="dashboard-section">
          <h3 className="section-title">Popular Slots</h3>
          <div className="card">
            {(!popularSlots || popularSlots.length === 0) ? (
              <p className="text-muted">No slots data available.</p>
            ) : (
              <div className="peak-chart" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '10px 0' }}>
                {popularSlots.map((s) => (
                  <div key={s.slot} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                    <div
                      className="peak-bar"
                      style={{ height: `${Math.max((s.count / maxPeakCount) * 100, 2)}px`, width: '40px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }}
                      title={`${s.slot} - ${s.count} bookings`}
                    />
                    <span style={{ fontSize: '10px', marginTop: '4px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{s.slot}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Booking List Modal */}
        {selectedStatus && (
          <div className="modal-overlay" onClick={() => setSelectedStatus(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
              <div className="modal-header">
                <h2 style={{ textTransform: 'capitalize' }}>{selectedStatus.replace(/_/g, ' ')} Bookings</h2>
                <button className="btn btn-ghost" onClick={() => setSelectedStatus(null)}>Close</button>
              </div>
              <div className="modal-body">
                {loadingBookings ? (
                  <div className="loading-container"><div className="spinner" /></div>
                ) : (
                  <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Slot</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Resolution Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statusBookings.map(b => (
                          <tr key={b._id} onClick={() => handleViewDetail(b._id)} style={{ cursor: 'pointer' }} className="table-row-hover">
                            <td>{b.bookingDate}</td>
                            <td>{b.timeSlotId}</td>
                            <td>{b.studentUserId?.name || b.mainStudent?.name}</td>
                            <td>{b.studentUserId?.email || '-'}</td>
                            <td>{b.mainStudent?.phoneNumber || '-'}</td>
                            <td>
                              <span className={`badge ${statusMap[b.status]?.className || 'badge-default'}`}>
                                {statusMap[b.status]?.label || b.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>
                              {b.status === 'completed' && b.expiresAt ? (
                                <span style={{ fontSize: '12px' }}>{new Date(b.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Checkout)</span>
                              ) : (b.status === 'cancelled_by_student' || b.status === 'cancelled_by_admin') && b.cancelledAt ? (
                                <span style={{ fontSize: '12px' }}>{new Date(b.cancelledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Cancelled)</span>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Booking Detail Modal */}
        {detailBooking && (
          <div className="modal-overlay" onClick={() => setDetailBooking(null)} style={{ zIndex: 1100 }}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Booking Details</h2>
                <button className="btn btn-ghost" onClick={() => setDetailBooking(null)}>Close</button>
              </div>
              <div className="modal-body">
                {loadingDetail ? (
                  <div className="loading-container"><div className="spinner" /></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <div><strong>Cabin:</strong> {detailBooking.cabinId?.name}</div>
                    <div><strong>Date:</strong> {detailBooking.bookingDate}</div>
                    <div><strong>Slot:</strong> {detailBooking.timeSlotId}</div>
                    <div><strong>Status:</strong> <span className={`badge ${statusMap[detailBooking.status]?.className || 'badge-default'}`}>{statusMap[detailBooking.status]?.label || detailBooking.status}</span></div>
                    <div><strong>Main Student:</strong> {detailBooking.mainStudent?.name}</div>
                    <div><strong>Enrollment:</strong> {detailBooking.mainStudent?.enrollmentNumber}</div>
                    <div><strong>Phone:</strong> {detailBooking.mainStudent?.phoneNumber}</div>
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
                    <div><strong>Requested:</strong> {new Date(detailBooking.requestedAt).toLocaleString()}</div>
                    {detailBooking.approvedAt && <div><strong>Approved:</strong> {new Date(detailBooking.approvedAt).toLocaleString()}</div>}
                    {detailBooking.expiresAt && <div><strong>Expires:</strong> {new Date(detailBooking.expiresAt).toLocaleString()}</div>}
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
