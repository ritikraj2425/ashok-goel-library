const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ADMIN_ROLES } = require('../utils/constants');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: [ADMIN_ROLES.ROOT, ADMIN_ROLES.ADMIN],
    default: ADMIN_ROLES.ADMIN,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
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

/**
 * Hash password before saving if it has been modified.
 */
adminSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Compare a plaintext password with the stored hash.
 */
adminSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

/**
 * Return a safe representation without password hash.
 */
adminSchema.methods.toPublic = function () {
  return {
    id: this._id,
    username: this.username,
    role: this.role,
    isActive: this.isActive,
    createdBy: this.createdBy,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

module.exports = mongoose.model('Admin', adminSchema);
