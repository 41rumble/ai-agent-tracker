const Discovery = require('../models/Discovery');
const Project = require('../models/Project');

const discoveryController = {
  getDiscoveriesByProject: async (req, res) => {
    try {
      const { projectId } = req.params;
      
      // Check if project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      // Get discoveries for this project
      const discoveries = await Discovery.find({ projectId })
        .sort({ relevanceScore: -1, discoveredAt: -1 });
      
      res.json(discoveries);
    } catch (error) {
      console.error('Get discoveries error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  getDiscoveryById: async (req, res) => {
    try {
      const discovery = await Discovery.findById(req.params.id);
      
      if (!discovery) {
        return res.status(404).json({ message: 'Discovery not found' });
      }
      
      // Check if user has access to the project this discovery belongs to
      const project = await Project.findById(discovery.projectId);
      if (!project || project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      res.json(discovery);
    } catch (error) {
      console.error('Get discovery error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  updateDiscoveryFeedback: async (req, res) => {
    try {
      const { userFeedback } = req.body;
      
      const discovery = await Discovery.findById(req.params.id);
      
      if (!discovery) {
        return res.status(404).json({ message: 'Discovery not found' });
      }
      
      // Check if user has access to the project this discovery belongs to
      const project = await Project.findById(discovery.projectId);
      if (!project || project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      // Update feedback
      discovery.userFeedback = userFeedback;
      await discovery.save();
      
      res.json({
        message: 'Feedback updated successfully',
        discovery
      });
    } catch (error) {
      console.error('Update discovery feedback error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = discoveryController;