'use client';

import StatusBadge from './StatusBadge';
import CountdownTimer from './CountdownTimer';

export default function CabinCard({ cabin, hasActiveBooking, onBook, bookingsLocked }) {
  const canBook = cabin.displayStatus === 'available' && !hasActiveBooking && !bookingsLocked;

  return (
    <div className="card cabin-card">
      <div className="cabin-card-header">
        <div>
          <h3>{cabin.name}</h3>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {cabin.code}
          </span>
        </div>
        <StatusBadge status={cabin.displayStatus} />
      </div>

      <div className="cabin-card-details">
        <div className="cabin-card-detail">
          <span className="label">Capacity</span>
          <span>{cabin.minPeople} - {cabin.maxPeople} people</span>
        </div>

        {(cabin.availableSlots?.length > 0 || cabin.holdSlots?.length > 0) && (
          <div className="cabin-card-detail" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>
            <span className="label">Slots Today</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
              {cabin.availableSlots?.map((slot) => (
                <span key={slot.id} style={{ 
                  fontSize: 'var(--font-size-xs)', 
                  background: 'var(--color-bg-secondary)', 
                  padding: '4px 8px', 
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)'
                }}>
                  {slot.label}
                </span>
              ))}
              {cabin.holdSlots?.map((slot) => (
                <span key={slot.id} style={{ 
                  fontSize: 'var(--font-size-xs)', 
                  background: 'rgba(255, 193, 7, 0.1)', 
                  color: 'var(--color-warning)',
                  padding: '4px 8px', 
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-warning)'
                }} title="Currently on hold pending admin approval">
                  {slot.label} (Hold)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="cabin-card-footer">
        {canBook ? (
          <button className="btn btn-primary" onClick={() => onBook(cabin)}>
            Book Cabin
          </button>
        ) : cabin.displayStatus === 'available' && hasActiveBooking ? (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            You have an active booking
          </span>
        ) : (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Currently unavailable
          </span>
        )}
      </div>
    </div>
  );
}
