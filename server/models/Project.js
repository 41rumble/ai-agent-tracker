const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MilestoneSchema = new Schema({
  description: {
    type: String,
    required: true
  },
  achieved: {
    type: Boolean,
    default: false
  },
  date: {
    type: Date
  }
});

const ProjectSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  goals: [{
    type: String
  }],
  interests: [{
    type: String
  }],
  domain: {
    type: String,
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentState: {
    progress: {
      type: String,
      default: 'Not Started'
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    milestones: [MilestoneSchema]
  },
  agentId: {
    type: String
  },
  assistantId: {
    type: String
  },
  threadId: {
    type: String
  },
  agentType: {
    type: Schema.Types.ObjectId,
    ref: 'AgentType'
  },
  notificationPreferences: {
    email: {
      enabled: {
        type: Boolean,
        default: false
      },
      frequency: {
        type: String,
        enum: ['immediate', 'daily', 'weekly'],
        default: 'daily'
      }
    },
    slack: {
      enabled: {
        type: Boolean,
        default: false
      },
      webhookUrl: {
        type: String
      },
      channel: {
        type: String
      }
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);