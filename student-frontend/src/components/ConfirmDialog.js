'use client';

import { useState } from 'react';

export default function ConfirmDialog({ title, message, confirmLabel, confirmClass, onConfirm, onCancel, showReason }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(showReason ? reason : undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
            {message}
          </p>
          {showReason && (
            <div className="form-group">
              <label className="form-label">Reason (optional)</label>
              <input
                type="text"
                className="form-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason..."
              />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className={`btn ${confirmClass || 'btn-primary'}`} onClick={handleConfirm} disabled={loading}>
            {loading ? 'Processing...' : confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
