const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ContextEntrySchema = new Schema({
  type: {
    type: String,
    enum: ['user_update', 'agent_question', 'user_response', 'milestone', 'feedback'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const ProjectContextSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  currentPhase: {
    type: String,
    default: 'initial'
  },
  progressPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  contextEntries: [ContextEntrySchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('ProjectContext', ProjectContextSchema);