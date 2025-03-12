const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ScheduleSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  taskType: {
    type: String,
    required: true,
    enum: ['search', 'summarize', 'update']
  },
  frequency: {
    type: String,
    required: true,
    enum: ['hourly', 'daily', 'weekly', 'monthly']
  },
  lastRun: {
    type: Date
  },
  nextRun: {
    type: Date,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  parameters: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('Schedule', ScheduleSchema);