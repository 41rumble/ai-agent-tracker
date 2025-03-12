const Project = require('../models/Project');
const searchService = require('../services/searchService');

const agentController = {
  triggerSearch: async (req, res) => {
    try {
      const { projectId } = req.body;
      
      // Check if project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      // Trigger search in background
      searchService.performProjectSearch(project)
        .then(results => {
          console.log(`Search completed for project ${projectId} with ${results.length} results`);
        })
        .catch(error => {
          console.error(`Search failed for project ${projectId}:`, error);
        });
      
      res.json({ message: 'Search triggered successfully' });
    } catch (error) {
      console.error('Trigger search error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  getRecommendations: async (req, res) => {
    try {
      const { projectId } = req.query;
      
      // Check if project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      // Generate summary
      const summary = await searchService.generateProjectSummary(project);
      
      if (!summary) {
        return res.json({
          message: 'No recent discoveries found for this project',
          summary: null,
          discoveries: []
        });
      }
      
      res.json({
        message: 'Recommendations generated successfully',
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