const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DiscoverySchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  source: {
    type: String,
    required: true
  },
  relevanceScore: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  categories: [{
    type: String
  }],
  type: {
    type: String,
    enum: ['Article', 'Discussion', 'News', 'Research', 'Tool', 'Other'],
    default: 'Article'
  },
  discoveredAt: {
    type: Date,
    default: Date.now
  },
  publicationDate: {
    type: Date,
    default: Date.now
  },
  presented: {
    type: Boolean,
    default: false
  },
  userFeedback: {
    useful: {
      type: Boolean
    },
    notes: {
      type: String
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Discovery', DiscoverySchema);