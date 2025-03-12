const Discovery = require('../models/Discovery');
const Project = require('../models/Project');
const mongoose = require('mongoose');
const contextAgentService = require('../services/contextAgentService');

const discoveryController = {
  getDiscoveriesByProject: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { filter = 'all', sort = 'relevance', limit = 50 } = req.query;
      
      // Check if project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      // Build query based on filter
      const query = { projectId };
      
      switch (filter) {
        case 'new':
          query.viewed = false;
          query.hidden = false;
          break;
        case 'viewed':
          query.viewed = true;
          query.hidden = false;
          break;
        case 'hidden':
          query.hidden = true;
          break;
        case 'useful':
          query['userFeedback.useful'] = true;
          break;
        case 'notUseful':
          query['userFeedback.notUseful'] = true;
          break;
        case 'all':
        default:
          query.hidden = false;
          break;
      }
      
      // Build sort options
      let sortOptions = {};
      switch (sort) {
        case 'relevance':
          sortOptions = { relevanceScore: -1, discoveredAt: -1 };
          break;
        case 'date':
          sortOptions = { discoveredAt: -1 };
          break;
        case 'feedback':
          sortOptions = { 'userFeedback.relevance': -1, relevanceScore: -1 };
          break;
        default:
          sortOptions = { relevanceScore: -1, discoveredAt: -1 };
      }
      
      // Get discoveries for this project
      const discoveries = await Discovery.find(query)
        .sort(sortOptions)
        .limit(parseInt(limit));
      
      // Count total discoveries by filter type
      const counts = {
        total: await Discovery.countDocuments({ projectId }),
        new: await Discovery.countDocuments({ projectId, viewed: false, hidden: false }),
        viewed: await Discovery.countDocuments({ projectId, viewed: true, hidden: false }),
        hidden: await Discovery.countDocuments({ projectId, hidden: true }),
        useful: await Discovery.countDocuments({ projectId, 'userFeedback.useful': true }),
        notUseful: await Discovery.countDocuments({ projectId, 'userFeedback.notUseful': true })
      };
      
      res.json({
        discoveries,
        counts,
        filter,
        sort
      });
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
      
      // Mark as viewed if not already
      if (!discovery.viewed) {
        discovery.viewed = true;
        discovery.viewedAt = new Date();
        await discovery.save();
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
      discovery.userFeedback = {
        ...discovery.userFeedback,
        ...userFeedback
      };
      
      // Mark as viewed if providing feedback
      if (!discovery.viewed) {
        discovery.viewed = true;
        discovery.viewedAt = new Date();
      }
      
      await discovery.save();
      
      // If feedback indicates this is useful or not useful, update the context
      if (userFeedback.useful === true || userFeedback.notUseful === true) {
        try {
          // Add feedback to project context
          await contextAgentService.addFeedbackToContext(
            discovery.projectId.toString(),
            discovery._id.toString(),
            discovery.title,
            userFeedback.useful === true ? 'positive' : 'negative',
            userFeedback.notes || ''
          );
        } catch (contextError) {
          console.error('Error updating context with feedback:', contextError);
          // Continue even if context update fails
        }
      }
      
      res.json({
        message: 'Feedback updated successfully',
        discovery
      });
    } catch (error) {
      console.error('Update discovery feedback error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  markDiscoveryAsViewed: async (req, res) => {
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
      
      // Mark as viewed
      discovery.viewed = true;
      discovery.viewedAt = new Date();
      await discovery.save();
      
      res.json({
        message: 'Discovery marked as viewed',
        discovery
      });
    } catch (error) {
      console.error('Mark discovery as viewed error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  toggleDiscoveryHidden: async (req, res) => {
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
      
      // Toggle hidden status
      discovery.hidden = !discovery.hidden;
      await discovery.save();
      
      res.json({
        message: discovery.hidden ? 'Discovery hidden' : 'Discovery unhidden',
        discovery
      });
    } catch (error) {
      console.error('Toggle discovery hidden error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  bulkUpdateDiscoveries: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { ids, action, filter } = req.body;
      
      // Check if project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      let query = {};
      
      // If specific IDs are provided, use those
      if (ids && ids.length > 0) {
        query = {
          _id: { $in: ids.map(id => mongoose.Types.ObjectId(id)) },
          projectId
        };
      } 
      // Otherwise, use the filter
      else if (filter) {
        query = { projectId };
        
        switch (filter) {
          case 'new':
            query.viewed = false;
            query.hidden = false;
            break;
          case 'viewed':
            query.viewed = true;
            query.hidden = false;
            break;
          case 'all':
            query.hidden = false;
            break;
          default:
            return res.status(400).json({ message: 'Invalid filter for bulk update' });
        }
      } else {
        return res.status(400).json({ message: 'Either ids or filter must be provided' });
      }
      
      let update = {};
      let updateMessage = '';
      
      // Apply the requested action
      switch (action) {
        case 'markViewed':
          update = { 
            viewed: true,
            viewedAt: new Date()
          };
          updateMessage = 'Discoveries marked as viewed';
          break;
        case 'markUnviewed':
          update = { 
            viewed: false,
            $unset: { viewedAt: "" }
          };
          updateMessage = 'Discoveries marked as unviewed';
          break;
        case 'hide':
          update = { hidden: true };
          updateMessage = 'Discoveries hidden';
          break;
        case 'unhide':
          update = { hidden: false };
          updateMessage = 'Discoveries unhidden';
          break;
        default:
          return res.status(400).json({ message: 'Invalid action' });
      }
      
      // Perform the update
      const result = await Discovery.updateMany(query, update);
      
      res.json({
        message: updateMessage,
        count: result.modifiedCount
      });
    } catch (error) {
      console.error('Bulk update discoveries error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = discoveryController;