const mongoose = require('mongoose');

const dayScheduleSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true }, // "HH:mm" e.g. "09:30"
    endTime: { type: String, required: true },   // "HH:mm" e.g. "21:30"
    slotDuration: { type: Number, required: true, min: 15 }, // minutes
    isClosed: { type: Boolean, default: false },
  },
  { _id: false }
);

const exceptionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotDuration: { type: Number, required: true, min: 15 },
    isClosed: { type: Boolean, default: false },
    label: { type: String, trim: true }, // optional label like "Holiday", "Special Hours"
  },
  { _id: true }
);

const systemSettingsSchema = new mongoose.Schema({
  // Singleton key — only one document should exist
  key: { type: String, default: 'global', unique: true },

  weeklySchedule: {
    monday:    { type: dayScheduleSchema, default: () => ({ startTime: '09:30', endTime: '21:30', slotDuration: 60 }) },
    tuesday:   { type: dayScheduleSchema, default: () => ({ startTime: '09:30', endTime: '21:30', slotDuration: 60 }) },
    wednesday: { type: dayScheduleSchema, default: () => ({ startTime: '09:30', endTime: '21:30', slotDuration: 60 }) },
    thursday:  { type: dayScheduleSchema, default: () => ({ startTime: '09:30', endTime: '21:30', slotDuration: 60 }) },
    friday:    { type: dayScheduleSchema, default: () => ({ startTime: '09:30', endTime: '21:30', slotDuration: 60 }) },
    saturday:  { type: dayScheduleSchema, default: () => ({ startTime: '09:30', endTime: '21:30', slotDuration: 60 }) },
    sunday:    { type: dayScheduleSchema, default: () => ({ startTime: '10:00', endTime: '17:00', slotDuration: 60 }) },
  },

  exceptions: {
    type: [exceptionSchema],
    default: [],
  },

  updatedAt: { type: Date, default: Date.now },
});

systemSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

/**
 * Get the singleton settings document, creating it with defaults if it doesn't exist.
 */
systemSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: 'global' }).lean();
  if (!settings) {
    settings = await this.create({ key: 'global' });
    settings = settings.toObject();
  }
  return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
