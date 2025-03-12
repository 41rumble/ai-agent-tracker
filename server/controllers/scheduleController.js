const Schedule = require('../models/Schedule');
const Project = require('../models/Project');
const schedulerService = require('../services/schedulerService');

const scheduleController = {
  getSchedulesByProject: async (req, res) => {
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
      
      // Get schedules for this project
      const schedules = await Schedule.find({ projectId });
      
      res.json(schedules);
    } catch (error) {
      console.error('Get schedules error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  createSchedule: async (req, res) => {
    try {
      const { projectId, taskType, frequency, parameters } = req.body;
      
      // Check if project exists and user has access
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      // Create schedule
      const schedule = await schedulerService.createSchedule(
        projectId,
        taskType,
        frequency,
        parameters
      );
      
      res.status(201).json({
        message: 'Schedule created successfully',
        schedule
      });
    } catch (error) {
      console.error('Create schedule error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  
  updateSchedule: async (req, res) => {
    try {
      console.log('Update schedule request received:', { 
        params: req.params,
        body: req.body,
        user: req.user?.id
      });
      
      const { frequency, active, parameters } = req.body;
      const scheduleId = req.params.id;
      
      if (!scheduleId || scheduleId === 'undefined') {
        console.error('Invalid schedule ID provided:', scheduleId);
        return res.status(400).json({ message: 'Invalid schedule ID' });
      }
      
      console.log(`Looking for schedule with ID: ${scheduleId}`);
      const schedule = await Schedule.findById(scheduleId);
      
      if (!schedule) {
        console.error(`Schedule not found with ID: ${scheduleId}`);
        return res.status(404).json({ message: 'Schedule not found' });
      }
      
      console.log(`Schedule found: ${schedule._id}, checking project access`);
      
      // Check if user has access to the project this schedule belongs to
      const project = await Project.findById(schedule.projectId);
      if (!project) {
        console.error(`Project not found for schedule: ${schedule._id}, projectId: ${schedule.projectId}`);
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (project.userId.toString() !== req.user.id) {
        console.error(`User ${req.user.id} not authorized for project ${project._id}`);
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      console.log(`Updating schedule ${scheduleId} with:`, { frequency, active, parameters });
      
      // Update schedule
      const updatedSchedule = await schedulerService.updateSchedule(
        scheduleId,
        { frequency, active, parameters }
      );
      
      console.log(`Schedule ${scheduleId} updated successfully`);
      
      res.json({
        message: 'Schedule updated successfully',
        schedule: updatedSchedule
      });
    } catch (error) {
      console.error('Update schedule error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: 'Server error', 
        error: error.message 
      });
    }
  },
  
  deleteSchedule: async (req, res) => {
    try {
      const schedule = await Schedule.findById(req.params.id);
      
      if (!schedule) {
        return res.status(404).json({ message: 'Schedule not found' });
      }
      
      // Check if user has access to the project this schedule belongs to
      const project = await Project.findById(schedule.projectId);
      if (!project || project.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      // Delete schedule
      await Schedule.findByIdAndDelete(req.params.id);
      
      res.json({ message: 'Schedule deleted successfully' });
    } catch (error) {
      console.error('Delete schedule error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = scheduleController;