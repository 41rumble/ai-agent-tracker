import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Paper,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import { apiService } from '../services/api';
import ScheduleList from '../components/schedules/ScheduleList';

interface Project {
  _id: string;
  name: string;
}

const SchedulesPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await apiService.getProjects();
      setProjects(response.data);
      
      // Select the first project by default if available
      if (response.data.length > 0) {
        setSelectedProjectId(response.data[0]._id);
      }
      
      setError('');
    } catch (err: any) {
      setError('Failed to load projects. Please try again.');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = (event: SelectChangeEvent) => {
    setSelectedProjectId(event.target.value);
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
          Scheduled Tasks
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Manage automated tasks for your projects
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {projects.length === 0 ? (
        <Alert severity="info">
          You don't have any projects yet. Create a project first to manage schedules.
        </Alert>
      ) : (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel id="project-select-label">Select Project</InputLabel>
              <Select
                labelId="project-select-label"
                id="project-select"
                value={selectedProjectId}
                label="Select Project"
                onChange={handleProjectChange}
              >
                {projects.map((project) => (
                  <MenuItem key={project._id} value={project._id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>
          
          {selectedProjectId && <ScheduleList projectId={selectedProjectId} />}
        </>
      )}
    </Container>
  );
};

export default SchedulesPage;