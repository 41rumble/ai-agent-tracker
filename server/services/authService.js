const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const apiConfig = require('../config/apiConfig');

const authService = {
  generateToken: (userId) => {
    return jwt.sign({ id: userId }, apiConfig.auth.jwtSecret, {
      expiresIn: apiConfig.auth.jwtExpiry
    });
  },
  
  verifyToken: (token) => {
    try {
      return jwt.verify(token, apiConfig.auth.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  },
  
  hashPassword: async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  },
  
  comparePassword: async (password, hashedPassword) => {
    return bcrypt.compare(password, hashedPassword);
  },
  
  authenticate: async (email, password) => {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('User not found');
    }
    
    const isMatch = await authService.comparePassword(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }
    
    return {
      token: authService.generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    };
  }
};

module.exports = authService;