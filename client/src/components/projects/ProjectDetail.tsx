import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  Card,
  CardContent,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import DiscoveryList from '../discoveries/DiscoveryList';
import ScheduleList from '../schedules/ScheduleList';
import ProjectContext from './ProjectContext';
import ProjectSummary from './ProjectSummary';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-tabpanel-${index}`}
      aria-labelledby={`project-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface Project {
  _id: string;
  name: string;
  description: string;
  domain: string;
  goals: string[];
  interests: string[];
  createdAt: string;
  currentState: {
    progress: string;
    lastUpdated: string;
    milestones: {
      description: string;
      achieved: boolean;
      date: string;
    }[];
  };
}

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchProject(id);
    }
  }, [id]);

  const fetchProject = async (projectId: string) => {
    try {
      setLoading(true);
      const response = await apiService.getProject(projectId);
      setProject(response.data);
      setError('');
    } catch (err: any) {
      setError('Failed to load project details. Please try again.');
      console.error('Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleTriggerSearch = async (force: boolean = false) => {
    if (!id) return;
    
    try {
      setIsSearching(true);
      
      // Show a toast or notification that search is running
      const searchResponse = await apiService.triggerSearch(id, force);
      
      // Update the project status to show it's in progress
      if (project) {
        setProject({
          ...project,
          currentState: {
            ...project.currentState,
            progress: 'In Progress',
            lastUpdated: new Date().toISOString()
          }
        });
      }
      
      // Show a success message that search is running in the background
      // Use the message from the API if available
      const message = searchResponse.data.message || 
        'Search triggered successfully! The system is now searching for new information in the background. This may take a few minutes to complete.';
      
      setSuccessMessage(message);
      setError('');
      
      // Refresh discoveries after search
      setTabValue(1); // Switch to discoveries tab
    } catch (err: any) {
      setError('Failed to trigger search. Please try again.');
      console.error('Error triggering search:', err);
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!project) {
    return (
      <Container maxWidth="md">
        <Alert severity="error" sx={{ mt: 4 }}>
          Project not found or you don't have access to it.
        </Alert>
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          onClick={() => navigate('/projects')}
        >
          Back to Projects
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 3, mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" component="h1">
              {project.name}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              Domain: {project.domain}
            </Typography>
          </Box>
          <Box>
            <Tooltip title="Edit Project">
              <IconButton 
                onClick={() => navigate(`/projects/edit/${project._id}`)}
                aria-label="edit project"
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Trigger Search">
              <IconButton 
                onClick={() => handleTriggerSearch(false)}
                disabled={isSearching}
                aria-label="trigger search"
                color="primary"
              >
                {isSearching ? <CircularProgress size={24} /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Manage Schedules">
              <IconButton 
                onClick={() => setTabValue(2)}
                aria-label="manage schedules"
                color="secondary"
              >
                <ScheduleIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {successMessage && (
          <Alert 
            severity="success" 
            sx={{ mt: 2 }}
            onClose={() => setSuccessMessage('')}
          >
            {successMessage}
          </Alert>
        )}
        
        <Divider sx={{ my: 2 }} />
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Typography variant="h6">Description</Typography>
            <Typography variant="body1" paragraph>
              {project.description}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Project Status
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current Progress:
                  </Typography>
                  <Chip 
                    label={project.currentState.progress} 
                    color={
                      project.currentState.progress === 'Not Started' ? 'default' :
                      project.currentState.progress === 'In Progress' ? 'primary' :
                      project.currentState.progress === 'Completed' ? 'success' : 'info'
                    }
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Last Updated: {new Date(project.currentState.lastUpdated).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6">Goals</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {project.goals.map((goal, index) => (
                  <Chip key={index} label={goal} />
                ))}
                {project.goals.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No goals defined
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6">Areas of Interest</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {project.interests.map((interest, index) => (
                  <Chip key={index} label={interest} color="secondary" />
                ))}
                {project.interests.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No interests defined
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
      
      <Box sx={{ mt: 4 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="project tabs">
          <Tab label="Overview" id="project-tab-0" aria-controls="project-tabpanel-0" />
          <Tab label="Discoveries" id="project-tab-1" aria-controls="project-tabpanel-1" />
          <Tab label="Schedules" id="project-tab-2" aria-controls="project-tabpanel-2" />
          <Tab label="Context Agent" id="project-tab-3" aria-controls="project-tabpanel-3" />
        </Tabs>
        
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                Project Overview
              </Typography>
              <Typography variant="body1" paragraph>
                This project is tracking advancements in {project.domain} with a focus on 
                {project.interests.length > 0 ? ` ${project.interests.join(', ')}` : ' various areas'}.
              </Typography>
              
              <Typography variant="h6" gutterBottom>
                Milestones
              </Typography>
            {project.currentState.milestones && project.currentState.milestones.length > 0 ? (
              project.currentState.milestones.map((milestone, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip 
                      label={milestone.achieved ? 'Achieved' : 'Pending'} 
                      color={milestone.achieved ? 'success' : 'default'}
                      size="small"
                    />
                    <Typography variant="body1">
                      {milestone.description}
                    </Typography>
                  </Box>
                  {milestone.date && (
                    <Typography variant="body2" color="text.secondary">
                      {milestone.achieved ? 'Completed on: ' : 'Target date: '}
                      {new Date(milestone.date).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                No milestones defined yet
              </Typography>
            )}
            
            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={() => handleTriggerSearch(false)}
                disabled={isSearching}
                startIcon={isSearching ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
              >
                {isSearching ? 'Searching...' : 'Search for Updates'}
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => handleTriggerSearch(true)}
                disabled={isSearching}
                startIcon={isSearching ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
              >
                Force New Search
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate(`/projects/edit/${project._id}`)}
                startIcon={<EditIcon />}
              >
                Edit Project
              </Button>
            </Box>
          </Paper>
          
          {/* Add the ProjectSummary component */}
          {id && <ProjectSummary projectId={id} />}
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {id && <DiscoveryList projectId={id} />}
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          {id && <ScheduleList projectId={id} />}
        </TabPanel>
        
        <TabPanel value={tabValue} index={3}>
          {id && <ProjectContext projectId={id} />}
        </TabPanel>
      </Box>
    </Container>
  );
};

export default ProjectDetail;