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
      const { force } = req.query; // Optional parameter to force generation of a new question
      
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
      
      // Check if we've asked a question recently (within the last 8 hours)
      // Only check if we're not forcing a new question
      if (force !== 'true') {
        const recentQuestions = context.contextEntries.filter(entry => {
          if (entry.type !== 'agent_question') return false;
          
          const entryDate = new Date(entry.timestamp);
          const eightHoursAgo = new Date();
          eightHoursAgo.setHours(eightHoursAgo.getHours() - 8);
          
          return entryDate > eightHoursAgo;
        });
        
        // If we have a recent question and no new discoveries, return the most recent one
        if (recentQuestions.length > 0) {
          // Check if there are new discoveries since the last question
          const lastQuestionTime = new Date(recentQuestions[0].timestamp);
          
          // Get discoveries since the last question
          const newDiscoveries = await Discovery.find({
            projectId,
            discoveredAt: { $gt: lastQuestionTime }
          }).countDocuments();
          
          // If no new discoveries and no project updates, return the existing question
          if (newDiscoveries === 0 && project.currentState.lastUpdated < lastQuestionTime) {
            const mostRecentQuestion = recentQuestions[0];
            
            return res.json({
              message: 'Using existing recent question',
              question: {
                questionId: mostRecentQuestion._id.toString(),
                question: mostRecentQuestion.content
              },
              isNew: false
            });
          }
        }
      }
      
      // Generate a new follow-up question
      const followUpQuestion = await contextAgentService.generateFollowUpQuestion(context);
      
      res.json({
        message: 'Question generated successfully',
        question: followUpQuestion,
        isNew: true
      });
    } catch (error) {
      console.error('Generate question error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = contextAgentController;