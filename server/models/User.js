const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  emailImportSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    sources: [{
      type: String
    }],
    server: {
      type: String,
      default: process.env.EMAIL_IMPORT_SERVER || 'mail.hover.com'
    },
    port: {
      type: Number,
      default: parseInt(process.env.EMAIL_IMPORT_PORT, 10) || 993
    },
    username: {
      type: String,
      default: process.env.EMAIL_IMPORT_USER || ''
    },
    password: {
      type: String,
      default: process.env.EMAIL_IMPORT_PASS || ''
    },
    secure: {
      type: Boolean,
      default: process.env.EMAIL_IMPORT_SECURE === 'true'
    },
    lastChecked: {
      type: Date
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);