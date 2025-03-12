const Project = require('../models/Project');
const searchService = require('../services/searchService');

const agentController = {
  triggerSearch: async (req, res) => {
    try {
      console.log('Search triggered with request body:', req.body);
      const { projectId } = req.body;
      
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
      
      // Trigger search in background
      searchService.performProjectSearch(project)
        .then(results => {
          console.log(`Search completed for project ${projectId} with ${results.length} results`);
        })
        .catch(error => {
          console.error(`Search failed for project ${projectId}:`, error);
          console.error('Search error details:', error.stack || error);
        });
      
      // Update project state to indicate search is in progress
      project.currentState.progress = 'In Progress';
      project.currentState.lastUpdated = new Date();
      await project.save();
      
      console.log(`Project ${projectId} state updated to In Progress`);
      
      res.json({ 
        message: 'Search triggered successfully',
        project: {
          id: project._id,
          name: project.name,
          currentState: project.currentState
        }
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