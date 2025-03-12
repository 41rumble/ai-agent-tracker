const Project = require('../models/Project');
const searchService = require('../services/searchService');
const notificationService = require('../services/notificationService');

const agentController = {
  triggerSearch: async (req, res) => {
    try {
      console.log('Search triggered with request body:', req.body);
      const { projectId, force } = req.body;
      
      if (!projectId) {
        console.error('No projectId provided in request body');
        return res.status(400).json({ message: 'Project ID is required' });
      }
      
      console.log(`Looking for project with ID: ${projectId}`);
      
      // Check if project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        console.error(`Project not found with ID: ${projectId}`);
        return res.status(404).json({ message: 'Project not found' });
      }
      
      console.log(`Project found: ${project.name}, checking user authorization`);
      console.log(`Project userId: ${project.userId}, Request user.id: ${req.user.id}`);
      
      if (project.userId.toString() !== req.user.id) {
        console.error(`User ${req.user.id} not authorized for project ${projectId}`);
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      console.log(`Starting search for project: ${project.name} (${projectId})`);
      
      // Check if we've searched recently (within the last 6 hours) and force is not true
      let recentSearchExists = false;
      if (!force) {
        const sixHoursAgo = new Date();
        sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
        
        // Get recent discoveries for this project
        const recentDiscoveries = await Discovery.find({
          projectId: project._id,
          createdAt: { $gt: sixHoursAgo }
        }).countDocuments();
        
        if (recentDiscoveries > 0) {
          recentSearchExists = true;
        }
      }
      
      // Update project state to indicate search is in progress
      project.currentState.progress = 'In Progress';
      project.currentState.lastUpdated = new Date();
      await project.save();
      
      console.log(`Project ${projectId} state updated to In Progress`);
      
      // Trigger search in background
      searchService.performProjectSearch(project)
        .then(results => {
          console.log(`Search completed for project ${projectId} with ${results.length} results`);
          
          // Send notifications about new discoveries if enabled
          if (results.length > 0) {
            notificationService.notifyAboutDiscoveries(projectId, results)
              .then(() => console.log(`Notifications sent for project ${projectId}`))
              .catch(notifyError => console.error(`Error sending notifications for project ${projectId}:`, notifyError));
          }
        })
        .catch(error => {
          console.error(`Search failed for project ${projectId}:`, error);
          console.error('Search error details:', error.stack || error);
        });
      
      // Respond with appropriate message based on whether recent search exists
      res.json({ 
        message: recentSearchExists 
          ? 'Search triggered successfully. Recent discoveries exist, so the system will evaluate if a new search is necessary.'
          : 'Search triggered successfully. The system will search for new information.',
        project: {
          id: project._id,
          name: project.name,
          currentState: project.currentState
        },
        recentSearchExists
      });
    } catch (error) {
      console.error('Trigger search error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  getRecommendations: async (req, res) => {
    try {
      const { projectId } = req.query;
      
      console.log(`Getting recommendations for project ${projectId} (using existing discoveries only)`);
      
      // Check if project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        console.log(`Project not found with ID: ${projectId}`);
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId.toString() !== req.user.id) {
        console.log(`User ${req.user.id} not authorized for project ${projectId}`);
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      // Generate summary from existing discoveries (no new search)
      console.log(`Generating summary from existing discoveries for project ${projectId}`);
      const summary = await searchService.generateProjectSummary(project);
      
      if (!summary) {
        console.log(`No discoveries found for project ${projectId}`);
        return res.json({
          message: 'No discoveries found for this project. Try running a search first.',
          summary: null,
          discoveries: []
        });
      }
      
      console.log(`Summary generated with ${summary.discoveries.length} discoveries`);
      res.json({
        message: 'Summary generated successfully from existing discoveries',
        summary: summary.summary,
        discoveries: summary.discoveries
      });
    } catch (error) {
      console.error('Get recommendations error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = agentController;