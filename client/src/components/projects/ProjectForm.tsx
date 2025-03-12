import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Container,
  Alert,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';

interface ProjectFormProps {
  initialData?: {
    id?: string;
    name: string;
    description: string;
    domain: string;
    goals: string[];
    interests: string[];
  };
  isEditing?: boolean;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ 
  initialData = { name: '', description: '', domain: '', goals: [], interests: [] },
  isEditing = false 
}) => {
  const [name, setName] = useState(initialData.name);
  const [description, setDescription] = useState(initialData.description);
  const [domain, setDomain] = useState(initialData.domain);
  const [goals, setGoals] = useState<string[]>(initialData.goals);
  const [interests, setInterests] = useState<string[]>(initialData.interests);
  const [newGoal, setNewGoal] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      const projectData = {
        name,
        description,
        domain,
        goals,
        interests
      };
      
      if (isEditing && initialData.id) {
        await apiService.updateProject(initialData.id, projectData);
      } else {
        await apiService.createProject(projectData);
      }
      
      navigate('/projects');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddGoal = () => {
    if (newGoal.trim() && !goals.includes(newGoal.trim())) {
      setGoals([...goals, newGoal.trim()]);
      setNewGoal('');
    }
  };

  const handleAddInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const handleDeleteGoal = (goalToDelete: string) => {
    setGoals(goals.filter(goal => goal !== goalToDelete));
  };

  const handleDeleteInterest = (interestToDelete: string) => {
    setInterests(interests.filter(interest => interest !== interestToDelete));
  };

  const handleDomainChange = (event: SelectChangeEvent) => {
    setDomain(event.target.value);
  };

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {isEditing ? 'Edit Project' : 'Create New Project'}
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            margin="normal"
            required
            fullWidth
            id="name"
            label="Project Name"
            name="name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="description"
            label="Project Description"
            name="description"
            multiline
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          
          <FormControl fullWidth margin="normal" required>
            <InputLabel id="domain-label">Domain</InputLabel>
            <Select
              labelId="domain-label"
              id="domain"
              value={domain}
              label="Domain"
              onChange={handleDomainChange}
            >
              <MenuItem value="visual effects and animation">Visual Effects and Animation</MenuItem>
              <MenuItem value="artificial intelligence">Artificial Intelligence</MenuItem>
              <MenuItem value="web development">Web Development</MenuItem>
              <MenuItem value="mobile development">Mobile Development</MenuItem>
              <MenuItem value="game development">Game Development</MenuItem>
              <MenuItem value="data science">Data Science</MenuItem>
              <MenuItem value="cybersecurity">Cybersecurity</MenuItem>
              <MenuItem value="cloud computing">Cloud Computing</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          
          <Typography variant="h6" sx={{ mt: 3 }}>
            Project Goals
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={9}>
              <TextField
                fullWidth
                id="newGoal"
                label="Add a Goal"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGoal())}
              />
            </Grid>
            <Grid item xs={3}>
              <Button 
                variant="contained" 
                onClick={handleAddGoal}
                fullWidth
              >
                Add Goal
              </Button>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {goals.map((goal, index) => (
              <Chip
                key={index}
                label={goal}
                onDelete={() => handleDeleteGoal(goal)}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
          
          <Typography variant="h6" sx={{ mt: 3 }}>
            Areas of Interest
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={9}>
              <TextField
                fullWidth
                id="newInterest"
                label="Add an Interest"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInterest())}
              />
            </Grid>
            <Grid item xs={3}>
              <Button 
                variant="contained" 
                onClick={handleAddInterest}
                fullWidth
              >
                Add Interest
              </Button>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {interests.map((interest, index) => (
              <Chip
                key={index}
                label={interest}
                onDelete={() => handleDeleteInterest(interest)}
                color="secondary"
                variant="outlined"
              />
            ))}
          </Box>
          
          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              sx={{ flex: 1 }}
            >
              {isSubmitting ? 'Saving...' : (isEditing ? 'Update Project' : 'Create Project')}
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/projects')}
              sx={{ flex: 1 }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default ProjectForm;