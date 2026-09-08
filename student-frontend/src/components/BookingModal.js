'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { createBookingRequest } from '@/lib/api';

export default function BookingModal({ cabin, onClose, onSuccess }) {
  const { user } = useAuth();

  const [userType, setUserType] = useState('student');
  const [formData, setFormData] = useState({
    mainStudentName: user?.name || '',
    mainStudentEnrollment: user?.enrollmentNumber || '',
    mainStudentPhone: user?.phoneNumber || '',
    peopleCount: cabin.minPeople,
    timeSlotId: cabin.availableSlots && cabin.availableSlots.length > 0 ? cabin.availableSlots[0].id : '',
  });
  const [groupMembers, setGroupMembers] = useState(
    Array.from({ length: Math.max(0, cabin.minPeople - 1) }, () => ({
      name: '',
      enrollmentNumber: '',
    }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePeopleCountChange = (e) => {
    const count = parseInt(e.target.value, 10);
    setFormData((prev) => ({ ...prev, peopleCount: count }));

    const newGroupSize = count - 1;
    setGroupMembers((prev) => {
      if (newGroupSize > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: newGroupSize - prev.length }, () => ({
            name: '',
            enrollmentNumber: '',
          })),
        ];
      }
      return prev.slice(0, newGroupSize);
    });
  };

  const handleGroupMemberChange = (index, field, value) => {
    setGroupMembers((prev) =>
      prev.map((member, i) => (i === index ? { ...member, [field]: value } : member))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const nameRegex = /^[a-zA-Z\s\.\-']+$/;
      const enrollmentRegex = /^\d+$/;
      const phoneRegex = /^\d{10}$/;

      const mainName = formData.mainStudentName.trim();
      const mainEnrollment = formData.mainStudentEnrollment.trim();
      const mainPhone = formData.mainStudentPhone.trim();

      const validateEnrollment = (enroll, label) => {
        if (userType === 'student') {
          if (enroll.startsWith('23')) {
            if (enroll.length !== 6) throw new Error(`${label} must be 6 digits.`);
          } else if (enroll.match(/^(2[4-9]|[3-9]\d)/)) {
            if (enroll.length !== 10) throw new Error(`${label} must be 10 digits.`);
          }
        }
      };

      if (!nameRegex.test(mainName)) throw new Error('Name should only contain letters.');
      if (!enrollmentRegex.test(mainEnrollment)) throw new Error('Enrollment/ID must be numbers only.');
      validateEnrollment(mainEnrollment, 'Main student enrollment');
      if (!phoneRegex.test(mainPhone)) throw new Error('Phone must be exactly 10 digits.');
      if (!formData.timeSlotId) throw new Error('Please select a valid time slot.');

      const enrollments = new Set([mainEnrollment]);

      if (userType === 'student') {
        for (let i = 0; i < groupMembers.length; i++) {
          const m = groupMembers[i];
          const mName = m.name.trim();
          const mEnrollment = m.enrollmentNumber.trim();

          if (!nameRegex.test(mName)) throw new Error(`Group member ${i + 2} name should only contain letters.`);
          if (!enrollmentRegex.test(mEnrollment)) throw new Error(`Group member ${i + 2} enrollment must be numbers only.`);
          validateEnrollment(mEnrollment, `Group member ${i + 2} enrollment`);

          if (enrollments.has(mEnrollment)) {
            throw new Error(`Duplicate enrollment number found: ${mEnrollment}`);
          }
          enrollments.add(mEnrollment);
        }
      }

      await createBookingRequest({
        cabinId: cabin.id,
        userType,
        mainStudent: {
          name: formData.mainStudentName.trim(),
          enrollmentNumber: formData.mainStudentEnrollment.trim(),
          phoneNumber: formData.mainStudentPhone.trim(),
        },
        groupMembers: userType === 'student' ? groupMembers.map((m) => ({
          name: m.name.trim(),
          enrollmentNumber: m.enrollmentNumber.trim(),
        })) : [],
        peopleCount: userType === 'student' ? formData.peopleCount : 1,
        timeSlotId: formData.timeSlotId,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create booking request');
    } finally {
      setLoading(false);
    }
  };

  // Generate people count options
  const countOptions = [];
  for (let i = cabin.minPeople; i <= cabin.maxPeople; i++) {
    countOptions.push(i);
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
                Time Slot (Today) <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={formData.timeSlotId}
                onChange={(e) => setFormData((prev) => ({ ...prev, timeSlotId: e.target.value }))}
                required
              >
                {cabin.availableSlots && cabin.availableSlots.length > 0 ? (
                  cabin.availableSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.label}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No slots available</option>
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
              </div>
            )}

            <div style={{ marginBottom: userType === 'student' ? 'var(--space-lg)' : 0 }}>
              <span className="form-label" style={{ display: 'block', marginBottom: 'var(--space-md)', fontWeight: 600 }}>
                {userType === 'student' ? 'Main Student (Booking Owner)' : 'Faculty Details'}
              </span>
              <div className="form-group">
                <label className="form-label">
                  Full Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.mainStudentName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, mainStudentName: e.target.value }))
                  }
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  {userType === 'student' ? 'Enrollment Number' : 'Employee ID'} <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.mainStudentEnrollment}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, mainStudentEnrollment: e.target.value }))
                  }
                  placeholder={`Enter ${userType === 'student' ? 'enrollment number' : 'employee ID'}`}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Phone Number <span className="required">*</span>
                </label>
                <input
                  type="tel"
                  className="form-input"
                  value={formData.mainStudentPhone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, mainStudentPhone: e.target.value }))
                  }
                  placeholder="Enter phone number"
                  required
                />
              </div>
            </div>

            {userType === 'student' && groupMembers.length > 0 && (
              <div className="group-members-section">
                <span className="form-label" style={{ display: 'block', marginBottom: 'var(--space-md)', fontWeight: 600 }}>
                  Group Members ({groupMembers.length})
                </span>
                {groupMembers.map((member, index) => (
                  <div key={index}>
                    <div className="group-member-label">Member {index + 2}</div>
                    <div className="group-member-row">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">
                          Name <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={member.name}
                          onChange={(e) =>
                            handleGroupMemberChange(index, 'name', e.target.value)
                          }
                          placeholder="Full name"
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">
                          Enrollment No. <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={member.enrollmentNumber}
                          onChange={(e) =>
                            handleGroupMemberChange(index, 'enrollmentNumber', e.target.value)
                          }
                          placeholder="Enrollment number"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Booking Request'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
