const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AgentTypeSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  domain: {
    type: String,
    required: true
  },
  capabilities: [{
    type: String
  }],
  searchStrategy: {
    type: String,
    enum: ['broad', 'focused', 'technical', 'creative', 'academic'],
    default: 'broad'
  },
  promptTemplate: {
    type: String,
    required: true
  },
  evaluationCriteria: [{
    type: String
  }],
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('AgentType', AgentTypeSchema);