const Project = require('../models/Project');
const openaiService = require('../services/openaiService');
const { validationResult } = require('express-validator');

const projectController = {
  createProject: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, goals, interests, domain } = req.body;
      const userId = req.user.id;

      // Create project in database
      const project = new Project({
        name,
        description,
        goals,
        interests,
        domain,
        userId
      });

      await project.save();

      // Create OpenAI agent for this project
      try {
        const agent = await openaiService.createProjectAgent({
          name,
          description,
          goals,
          interests,
          domain
        });

        // Update project with agent ID
        project.agentId = agent.id;
        await project.save();
      } catch (agentError) {
        console.error('Error creating agent:', agentError);
        // Continue even if agent creation fails
      }

      res.status(201).json({
        message: 'Project created successfully',
        project
      });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  getAllProjects: async (req, res) => {
    try {
      const userId = req.user.id;
      const projects = await Project.find({ userId });
      res.json(projects);
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  getProjectById: async (req, res) => {
    try {
      const project = await Project.findById(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Check if user owns this project
      if (project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      res.json(project);
    } catch (error) {
      console.error('Get project error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  updateProject: async (req, res) => {
    try {
      const { name, description, goals, interests, domain, currentState } = req.body;
      
      // Find project and check ownership
      const project = await Project.findById(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      if (project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      // Update fields
      if (name) project.name = name;
      if (description) project.description = description;
      if (goals) project.goals = goals;
      if (interests) project.interests = interests;
      if (domain) project.domain = domain;
      if (currentState) {
        project.currentState = {
          ...project.currentState,
          ...currentState,
          lastUpdated: Date.now()
        };
      }

      await project.save();

      // Update agent if it exists
      if (project.agentId) {
        try {
          await openaiService.updateProjectAgent(project.agentId, {
            name: project.name,
            description: project.description,
            goals: project.goals,
            interests: project.interests,
            domain: project.domain
          });
        } catch (agentError) {
          console.error('Error updating agent:', agentError);
          // Continue even if agent update fails
        }
      }

      res.json({
        message: 'Project updated successfully',
        project
      });
    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  deleteProject: async (req, res) => {
    try {
      // Find project and check ownership
      const project = await Project.findById(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      if (project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      // Delete agent if it exists
      if (project.agentId) {
        try {
          await openaiService.deleteProjectAgent(project.agentId);
        } catch (agentError) {
          console.error('Error deleting agent:', agentError);
          // Continue even if agent deletion fails
        }
      }

      // Delete project
      await Project.findByIdAndDelete(req.params.id);

      res.json({ message: 'Project deleted successfully' });
    } catch (error) {
      console.error('Delete project error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = projectController;