const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  enrollmentNumber: {
    type: String,
    trim: true,
  },
  blockedUntil: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLoginAt: {
    type: Date,
  },
});

userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    isBlocked: this.isBlocked,
    blockedUntil: this.blockedUntil,
    phoneNumber: this.phoneNumber,
    enrollmentNumber: this.enrollmentNumber,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

module.exports = mongoose.model('User', userSchema);
