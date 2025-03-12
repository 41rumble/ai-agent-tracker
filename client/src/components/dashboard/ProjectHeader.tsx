import React from 'react';
import {
  Box, Paper, Typography, Chip, Button, IconButton, Tooltip,
  Grid, LinearProgress
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface ProjectHeaderProps {
  project: any;
  discoveryStats: any;
  onTriggerSearch: () => void;
  isSearching?: boolean;
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({ 
  project, 
  discoveryStats, 
  onTriggerSearch,
  isSearching = false
}) => {
  const navigate = useNavigate();
  
  if (!project) return null;
  
  // Calculate milestone progress
  const totalMilestones = project.currentState?.milestones?.length || 0;
  const completedMilestones = project.currentState?.milestones?.filter((m: any) => m.achieved)?.length || 0;
  const progressPercentage = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;
  
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Grid container spacing={2}>
        {/* Project Title and Domain */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h4" component="h1">
                {project.name}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                Domain: {project.domain}
              </Typography>
            </Box>
          </Box>
        </Grid>
        
        {/* Project Stats */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6">{discoveryStats.total || 0}</Typography>
              <Typography variant="body2">Total Discoveries</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="error">{discoveryStats.new || 0}</Typography>
              <Typography variant="body2">New</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="success.main">{discoveryStats.useful || 0}</Typography>
              <Typography variant="body2">Useful</Typography>
            </Box>
          </Box>
          
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
            <Tooltip title="Trigger Search">
              <Button 
                variant="contained"
                startIcon={isSearching ? undefined : <RefreshIcon />}
                onClick={onTriggerSearch}
                disabled={isSearching}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </Tooltip>
            <Tooltip title="Edit Project">
              <IconButton onClick={() => navigate(`/projects/edit/${project._id}`)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Manage Schedules">
              <IconButton onClick={() => navigate(`/projects/${project._id}/schedules`)}>
                <ScheduleIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Grid>
        
        {/* Progress Bar */}
        <Grid item xs={12}>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Project Progress</Typography>
              <Typography variant="body2" fontWeight="bold">
                {project.currentState.progress} ({completedMilestones}/{totalMilestones} milestones)
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progressPercentage} 
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default ProjectHeader;