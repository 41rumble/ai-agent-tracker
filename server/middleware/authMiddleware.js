const authService = require('../services/authService');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    
    // Attach user to request
    req.user = { 
      _id: decoded.id || decoded._id, // Support both formats
      id: decoded.id || decoded._id   // Support both formats
    };
    console.log('User authenticated:', req.user);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;