import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  Card,
  CardContent,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { apiService } from '../../services/api';

interface ProjectSummaryProps {
  projectId: string;
}

const ProjectSummary: React.FC<ProjectSummaryProps> = ({ projectId }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [discoveries, setDiscoveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [projectId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await apiService.getRecommendations(projectId);
      
      if (response.data && response.data.summary) {
        setSummary(response.data.summary);
        setDiscoveries(response.data.discoveries || []);
      } else {
        setSummary(null);
      }
      
      setError('');
    } catch (err: any) {
      setError('Failed to load summary. Please try again.');
      console.error('Error fetching summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    try {
      setGenerating(true);
      setError('');
      
      // First trigger a search to find new discoveries
      await apiService.triggerSearch(projectId);
      
      // Then generate a new summary
      const response = await apiService.getRecommendations(projectId);
      
      if (response.data && response.data.summary) {
        setSummary(response.data.summary);
        setDiscoveries(response.data.discoveries || []);
      } else {
        setSummary(null);
      }
    } catch (err: any) {
      setError('Failed to generate summary. Please try again.');
      console.error('Error generating summary:', err);
    } finally {
      setGenerating(false);
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
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            Project Summary
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={generateSummary}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate New Summary'}
          </Button>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {!summary ? (
          <Alert severity="info">
            No summary available yet. Click "Generate New Summary" to create one based on the latest discoveries.
          </Alert>
        ) : (
          <>
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="h6" gutterBottom>
                    Latest Insights
                  </Typography>
                  <Tooltip title="This summary is generated based on the most relevant discoveries for your project">
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                  {summary}
                </Typography>
              </CardContent>
            </Card>
            
            {discoveries.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom>
                  Key Discoveries
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {discoveries.slice(0, 3).map((discovery) => (
                    <Card key={discovery._id} variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Typography variant="subtitle1" component="h3" gutterBottom>
                            {discovery.title}
                          </Typography>
                          <Chip 
                            label={discovery.type} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {discovery.description.length > 200 
                            ? `${discovery.description.substring(0, 200)}...` 
                            : discovery.description}
                        </Typography>
                        <Button 
                          size="small" 
                          href={discovery.source}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Source
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
};

export default ProjectSummary;