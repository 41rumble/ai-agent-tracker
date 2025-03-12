const User = require('../models/User');
const authService = require('../services/authService');
const { validationResult } = require('express-validator');

const authController = {
  register: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password } = req.body;

      // Check if user already exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await authService.hashPassword(password);

      // Create new user
      user = new User({
        name,
        email,
        password: hashedPassword
      });

      await user.save();

      // Generate JWT
      const authData = await authService.authenticate(email, password);

      res.status(201).json({
        message: 'User registered successfully',
        token: authData.token,
        user: authData.user
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  login: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      try {
        const authData = await authService.authenticate(email, password);
        
        // Update last login time
        await User.findByIdAndUpdate(authData.user.id, {
          lastLogin: new Date()
        });

        res.json({
          message: 'Login successful',
          token: authData.token,
          user: authData.user
        });
      } catch (error) {
        return res.status(401).json({ message: error.message });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  getProfile: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = authController;