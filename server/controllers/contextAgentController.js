const Project = require('../models/Project');
const contextAgentService = require('../services/contextAgentService');
const searchService = require('../services/searchService');

const contextAgentController = {
  /**
   * Get the current context for a project
   */
  getProjectContext: async (req, res) => {
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
      
      // Get project context
      const context = await contextAgentService.getProjectContext(projectId);
      
      res.json({
        message: 'Project context retrieved successfully',
        context
      });
    } catch (error) {
      console.error('Get project context error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  /**
   * Add a user update to the project context
   */
  addUserUpdate: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { content, metadata } = req.body;
      
      // Check if project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      // Add user update
      const result = await contextAgentService.addUserUpdate(projectId, content, metadata);
      
      res.json({
        message: 'User update added successfully',
        context: result.context,
        followUpQuestion: result.followUpQuestion
      });
    } catch (error) {
      console.error('Add user update error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  /**
   * Add a user response to an agent question
   */
  addUserResponse: async (req, res) => {
    try {
      const { projectId, questionId } = req.params;
      const { response, metadata } = req.body;
      
      // Check if project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      // Add user response
      const result = await contextAgentService.addUserResponse(projectId, questionId, response, metadata);
      
      // Trigger a contextual search based on the updated context
      try {
        const queries = await contextAgentService.generateContextualSearchQueries(projectId);
        
        // Perform search in background
        if (queries && queries.length > 0) {
          searchService.performContextualSearch(project, queries)
            .then(results => {
              console.log(`Contextual search completed for project ${projectId} with ${results.length} results`);
            })
            .catch(error => {
              console.error(`Contextual search failed for project ${projectId}:`, error);
            });
        }
      } catch (searchError) {
        console.error('Error triggering contextual search:', searchError);
        // Continue even if search fails
      }
      
      res.json({
        message: 'User response added successfully',
        context: result.context,
        followUpQuestion: result.followUpQuestion
      });
    } catch (error) {
      console.error('Add user response error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  /**
   * Generate a follow-up question for the project
   */
  generateQuestion: async (req, res) => {
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
      
      // Get project context
      const context = await contextAgentService.getProjectContext(projectId);
      
      // Generate follow-up question
      const followUpQuestion = await contextAgentService.generateFollowUpQuestion(context);
      
      res.json({
        message: 'Question generated successfully',
        question: followUpQuestion
      });
    } catch (error) {
      console.error('Generate question error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = contextAgentController;