const mongoose = require('mongoose');

const cabinSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  minPeople: {
    type: Number,
    required: true,
    min: 1,
  },
  maxPeople: {
    type: Number,
    required: true,
    min: 1,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Validate that minPeople <= maxPeople before saving.
 */
cabinSchema.pre('save', function (next) {
  if (this.minPeople > this.maxPeople) {
    return next(new Error('minPeople cannot be greater than maxPeople'));
  }
  this.updatedAt = new Date();
  next();
});

cabinSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.$set) {
    update.$set.updatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Cabin', cabinSchema);
