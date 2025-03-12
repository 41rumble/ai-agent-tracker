const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const Project = require('../models/Project');
const searchService = require('./searchService');
const openaiService = require('./openaiService');

const schedulerService = {
  initializeScheduler: async () => {
    try {
      console.log('Initializing scheduler...');
      
      // Set up hourly job to check and execute scheduled tasks
      cron.schedule('0 * * * *', async () => {
        console.log('Running scheduled task check...');
        await schedulerService.processScheduledTasks();
      });
      
      console.log('Scheduler initialized');
    } catch (error) {
      console.error('Scheduler initialization error:', error);
    }
  },
  
  processScheduledTasks: async () => {
    try {
      const now = new Date();
      
      // Find all active schedules that are due
      const dueSchedules = await Schedule.find({
        active: true,
        nextRun: { $lte: now }
      });
      
      console.log(`Found ${dueSchedules.length} due schedules`);
      
      // Process each due schedule
      for (const schedule of dueSchedules) {
        try {
          await schedulerService.executeTask(schedule);
          
          // Update last run time and calculate next run
          schedule.lastRun = now;
          schedule.nextRun = schedulerService.calculateNextRun(now, schedule.frequency);
          await schedule.save();
          
          console.log(`Schedule ${schedule._id} executed and updated`);
        } catch (taskError) {
          console.error(`Error executing task for schedule ${schedule._id}:`, taskError);
        }
      }
    } catch (error) {
      console.error('Process scheduled tasks error:', error);
    }
  },
  
  executeTask: async (schedule) => {
    const { taskType, projectId, parameters } = schedule;
    
    // Get project data
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    switch (taskType) {
      case 'search':
        await searchService.performProjectSearch(project);
        break;
      case 'summarize':
        await searchService.generateProjectSummary(project);
        break;
      case 'update':
        // Implement project update logic
        break;
      default:
        throw new Error(`Unknown task type: ${taskType}`);
    }
  },
  
  calculateNextRun: (currentDate, frequency) => {
    const nextRun = new Date(currentDate);
    
    switch (frequency) {
      case 'hourly':
        nextRun.setHours(nextRun.getHours() + 1);
        break;
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      default:
        // Default to daily
        nextRun.setDate(nextRun.getDate() + 1);
    }
    
    return nextRun;
  },
  
  createSchedule: async (projectId, taskType, frequency, parameters = {}) => {
    try {
      const now = new Date();
      const nextRun = schedulerService.calculateNextRun(now, frequency);
      
      const schedule = new Schedule({
        projectId,
        taskType,
        frequency,
        nextRun,
        parameters
      });
      
      await schedule.save();
      return schedule;
    } catch (error) {
      console.error('Create schedule error:', error);
      throw new Error('Failed to create schedule');
    }
  },
  
  updateSchedule: async (scheduleId, updates) => {
    try {
      const schedule = await Schedule.findById(scheduleId);
      
      if (!schedule) {
        throw new Error('Schedule not found');
      }
      
      // Update fields
      if (updates.frequency) {
        schedule.frequency = updates.frequency;
        // Recalculate next run time based on new frequency
        schedule.nextRun = schedulerService.calculateNextRun(new Date(), updates.frequency);
      }
      
      if (updates.active !== undefined) {
        schedule.active = updates.active;
      }
      
      if (updates.parameters) {
        schedule.parameters = {
          ...schedule.parameters,
          ...updates.parameters
        };
      }
      
      await schedule.save();
      return schedule;
    } catch (error) {
      console.error('Update schedule error:', error);
      throw new Error('Failed to update schedule');
    }
  }
};

module.exports = schedulerService;