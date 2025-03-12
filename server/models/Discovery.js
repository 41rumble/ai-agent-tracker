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
  viewed: {
    type: Boolean,
    default: false
  },
  viewedAt: {
    type: Date
  },
  userFeedback: {
    useful: {
      type: Boolean
    },
    notUseful: {
      type: Boolean
    },
    relevance: {
      type: Number,
      min: 0,
      max: 10
    },
    notes: {
      type: String
    },
    tags: [{
      type: String
    }]
  },
  searchQueryUsed: {
    type: String
  },
  searchContext: {
    type: Object
  },
  hidden: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Discovery', DiscoverySchema);