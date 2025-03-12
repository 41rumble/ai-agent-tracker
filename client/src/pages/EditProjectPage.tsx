import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Alert, Container, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ProjectForm from '../components/projects/ProjectForm';
import { apiService } from '../services/api';

const EditProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      
      // Transform the data to match the form's expected format
      const projectData = {
        id: response.data._id,
        name: response.data.name,
        description: response.data.description,
        domain: response.data.domain,
        goals: response.data.goals,
        interests: response.data.interests
      };
      
      setProject(projectData);
      setError('');
    } catch (err: any) {
      setError('Failed to load project. Please try again.');
      console.error('Error fetching project:', err);
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

  if (error) {
    return (
      <Container maxWidth="md">
        <Alert severity="error" sx={{ mt: 4 }}>
          {error}
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

  return project ? <ProjectForm initialData={project} isEditing={true} /> : null;
};

export default EditProjectPage;