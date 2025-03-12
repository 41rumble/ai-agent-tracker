import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Grid,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardActions,
  Divider
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Project {
  _id: string;
  name: string;
  domain: string;
  currentState: {
    progress: string;
  };
}

interface Discovery {
  _id: string;
  title: string;
  description: string;
  projectId: string;
  relevanceScore: number;
  discoveredAt: string;
}

const DashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentDiscoveries, setRecentDiscoveries] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch projects
      const projectsResponse = await apiService.getProjects();
      setProjects(projectsResponse.data);
      
      // Fetch recent discoveries for all projects
      if (projectsResponse.data.length > 0) {
        const projectIds = projectsResponse.data.map((project: Project) => project._id);
        const recentDiscoveriesPromises = projectIds.map((id: string) =>
          apiService.getDiscoveries(id)
        );

        const discoveryResponses = await Promise.all(recentDiscoveriesPromises);
        
        // Handle the new response format which might include discoveries in a nested property
        const allDiscoveries = discoveryResponses.flatMap(response => {
          // Check if the response has a discoveries property (new format)
          if (response.data && response.data.discoveries) {
            return response.data.discoveries;
          }
          // Otherwise, assume the response data is the discoveries array (old format)
          return response.data || [];
        });
        
        // Filter out any discoveries without a description and sort by date
        const sortedDiscoveries = allDiscoveries
          .filter((discovery: any) => discovery && discovery.description) // Filter out any discoveries without a description
          .sort((a: Discovery, b: Discovery) =>
            new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime()
          )
          .slice(0, 5);

        setRecentDiscoveries(sortedDiscoveries);
      }
      
      setError('');
    } catch (err: any) {
      setError('Failed to load dashboard data. Please try again.');
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome, {user?.name}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Your AI Agent Tracker Dashboard
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5">
                Your Projects
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/projects/new')}
              >
                New Project
              </Button>
            </Box>
            
            {projects.length === 0 ? (
              <Alert severity="info">
                You don't have any projects yet. Create your first project to start tracking AI advancements.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {projects.slice(0, 4).map((project) => (
                  <Grid item xs={12} sm={6} key={project._id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" component="h2" gutterBottom>
                          {project.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Domain: {project.domain}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Status: {project.currentState.progress}
                        </Typography>
                      </CardContent>
                      <CardActions>
                        <Button size="small" onClick={() => navigate(`/projects/${project._id}`)}>
                          View Details
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
            
            {projects.length > 4 && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button onClick={() => navigate('/projects')}>
                  View All Projects
                </Button>
              </Box>
            )}
          </Paper>
          
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5">
                Recent Discoveries
              </Typography>
              <Button
                startIcon={<RefreshIcon />}
                onClick={fetchDashboardData}
              >
                Refresh
              </Button>
            </Box>
            
            {recentDiscoveries.length === 0 ? (
              <Alert severity="info">
                No recent discoveries found. Try triggering a search in one of your projects.
              </Alert>
            ) : (
              <Box>
                {recentDiscoveries.map((discovery, index) => (
                  <React.Fragment key={discovery._id}>
                    <Box sx={{ py: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        {discovery.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {discovery.description && discovery.description.length > 200 
                          ? `${discovery.description.substring(0, 200)}...` 
                          : discovery.description || 'No description available'}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          Discovered: {new Date(discovery.discoveredAt).toLocaleDateString()}
                        </Typography>
                        <Button 
                          size="small"
                          onClick={() => {
                            const project = projects.find(p => p._id === discovery.projectId);
                            if (project) {
                              navigate(`/projects/${project._id}`);
                            }
                          }}
                        >
                          View Project
                        </Button>
                      </Box>
                    </Box>
                    {index < recentDiscoveries.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Quick Stats
            </Typography>
            <Box sx={{ my: 2 }}>
              <Typography variant="body1">
                Total Projects: {projects.length}
              </Typography>
              <Typography variant="body1">
                Recent Discoveries: {recentDiscoveries.length}
              </Typography>
              <Typography variant="body1">
                Active Projects: {projects.filter(p => p.currentState.progress === 'In Progress').length}
              </Typography>
            </Box>
          </Paper>
          
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/projects/new')}
                fullWidth
              >
                Create New Project
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/projects')}
                fullWidth
              >
                View All Projects
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DashboardPage;