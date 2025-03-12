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
  Tooltip,
  Badge
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newDiscoveriesCount, setNewDiscoveriesCount] = useState(0);
  const [summaryAge, setSummaryAge] = useState<number>(0); // Age in hours

  useEffect(() => {
    // Check if we have a summary in localStorage
    const storedSummary = localStorage.getItem(`project_summary_${projectId}`);
    
    if (storedSummary) {
      try {
        const parsedSummary = JSON.parse(storedSummary);
        setSummary(parsedSummary.summary);
        setDiscoveries(parsedSummary.discoveries || []);
        setLastUpdated(new Date(parsedSummary.lastUpdated));
        
        // Calculate summary age
        const now = new Date();
        const lastUpdatedDate = new Date(parsedSummary.lastUpdated);
        const hoursSinceUpdate = Math.floor((now.getTime() - lastUpdatedDate.getTime()) / (1000 * 60 * 60));
        setSummaryAge(hoursSinceUpdate);
        
        // We still have loading state to true to check for new discoveries
        checkForNewDiscoveries();
      } catch (error) {
        console.error('Error parsing stored summary:', error);
        fetchSummary(); // Fallback to fetching from API
      }
    } else {
      // No stored summary, fetch from API
      fetchSummary();
    }
  }, [projectId]);

  // Function to check for new discoveries
  const checkForNewDiscoveries = async () => {
    try {
      // Get the latest discoveries
      const response = await apiService.getDiscoveries(projectId);
      
      // Handle the new response format
      let latestDiscoveries = [];
      if (response.data && response.data.discoveries) {
        latestDiscoveries = response.data.discoveries;
      } else {
        latestDiscoveries = response.data || [];
      }
      
      // If we have a last updated timestamp, count discoveries newer than that
      if (lastUpdated && latestDiscoveries.length > 0) {
        const newCount = latestDiscoveries.filter(
          (d: any) => new Date(d.discoveredAt) > lastUpdated
        ).length;
        
        setNewDiscoveriesCount(newCount);
      }
      
      // Set loading to false after checking
      setLoading(false);
    } catch (error) {
      console.error('Error checking for new discoveries:', error);
      setLoading(false);
    }
  };

  // Check for new discoveries periodically without regenerating the summary
  useEffect(() => {
    // Check for new discoveries when the component mounts and we have a lastUpdated timestamp
    if (lastUpdated && !loading) {
      checkForNewDiscoveries();
    }
    
    // Set up periodic check for new discoveries (every 5 minutes)
    const interval = setInterval(() => {
      if (lastUpdated) {
        checkForNewDiscoveries();
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [projectId, lastUpdated, loading]);

  // Calculate time since last update
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (lastUpdated) {
      interval = setInterval(() => {
        const now = new Date();
        const hoursSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60));
        setSummaryAge(hoursSinceUpdate);
      }, 60000); // Check every minute
      
      // Initial calculation
      const now = new Date();
      const hoursSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60));
      setSummaryAge(hoursSinceUpdate);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [lastUpdated]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await apiService.getRecommendations(projectId);
      
      if (response.data && response.data.summary) {
        setSummary(response.data.summary);
        setDiscoveries(response.data.discoveries || []);
        
        // Store the current time as the last updated time
        const now = new Date();
        setLastUpdated(now);
        
        // Reset new discoveries count
        setNewDiscoveriesCount(0);
        
        // Set summary age to 0 (fresh)
        setSummaryAge(0);
        
        // Store the summary in localStorage
        const summaryData = {
          summary: response.data.summary,
          discoveries: response.data.discoveries || [],
          lastUpdated: now.toISOString()
        };
        localStorage.setItem(`project_summary_${projectId}`, JSON.stringify(summaryData));
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

  // Calculate if summary needs refresh (older than 24 hours or has new discoveries)
  const needsRefresh = summaryAge > 24 || newDiscoveriesCount > 0;

  const generateSummary = async (force: boolean = false) => {
    try {
      setGenerating(true);
      setError('');
      
      // First trigger a search to find new discoveries
      const searchResponse = await apiService.triggerSearch(projectId, force);
      
      // Show a message that the search is running in the background
      setSummary(prev => {
        const backgroundMessage = `
## 🔍 Search triggered successfully! 

${searchResponse.data.recentSearchExists && !force 
  ? 'The system is evaluating if a new search is necessary based on recent discoveries and project context.'
  : 'The system is now searching for new information related to your project.'}

This process runs in the background and may take a few minutes to complete.

${prev ? '\n\n### Previous summary:\n' + prev : ''}`;
        return backgroundMessage;
      });
      
      // Wait a moment to allow the search to start processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Then generate a new summary
      const response = await apiService.getRecommendations(projectId);
      
      if (response.data && response.data.summary) {
        setSummary(response.data.summary);
        setDiscoveries(response.data.discoveries || []);
        
        // Store the current time as the last updated time
        const now = new Date();
        setLastUpdated(now);
        
        // Reset new discoveries count
        setNewDiscoveriesCount(0);
        
        // Set summary age to 0 (fresh)
        setSummaryAge(0);
        
        // Store the summary in localStorage
        const summaryData = {
          summary: response.data.summary,
          discoveries: response.data.discoveries || [],
          lastUpdated: now.toISOString()
        };
        localStorage.setItem(`project_summary_${projectId}`, JSON.stringify(summaryData));
      } else {
        const searchInProgressMessage = `
## 🔍 Search in progress...

The system is currently searching for new information related to your project. This process runs in the background and may take a few minutes to complete.

Check back later to see the results, or refresh this page.`;
        
        setSummary(searchInProgressMessage);
        
        // We don't store this temporary message in localStorage
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
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="h5">
              Project Summary
            </Typography>
            {newDiscoveriesCount > 0 && (
              <Badge 
                badgeContent={newDiscoveriesCount} 
                color="error" 
                sx={{ ml: 1 }}
              >
                <NotificationsIcon color="action" />
              </Badge>
            )}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleString()}` : 'Never updated'}
            </Typography>
            <Box sx={{ display: 'inline-flex' }}>
              <Button
                variant="contained"
                startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                onClick={() => generateSummary(false)}
                disabled={generating}
                color={needsRefresh ? "primary" : "inherit"}
              >
                {generating ? 'Generating...' : needsRefresh ? 'Update Summary' : 'Generate Summary'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => generateSummary(true)}
                disabled={generating}
                color="secondary"
                size="small"
              >
                Force New
              </Button>
            </Box>
          </Box>
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
                <Box sx={{
                  '& a': { color: 'primary.main' },
                  '& h1, & h2, & h3, & h4, & h5, & h6': {
                    mt: 2,
                    mb: 1,
                    fontWeight: 'bold',
                    fontFamily: 'inherit'
                  },
                  '& p': { mb: 1.5 },
                  '& ul, & ol': { pl: 2, mb: 1.5 },
                  '& blockquote': {
                    borderLeft: '4px solid #ddd',
                    pl: 2,
                    fontStyle: 'italic',
                    my: 1.5
                  },
                  '& code': {
                    fontFamily: 'monospace',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    p: 0.5,
                    borderRadius: 1
                  }
                }}>
                  <ReactMarkdown>
                    {summary}
                  </ReactMarkdown>
                </Box>
              </CardContent>
            </Card>

            {discoveries.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Referenced Discoveries
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {discoveries.slice(0, 3).map((discovery, index) => (
                  <Box key={discovery._id} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" component="h3">
                      {discovery.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {discovery.description.length > 200 
                        ? `${discovery.description.substring(0, 200)}...` 
                        : discovery.description}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip 
                          label={discovery.type} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                        />
                        {discovery.categories.slice(0, 2).map((category: string, i: number) => (
                          <Chip key={i} label={category} size="small" />
                        ))}
                      </Box>
                      <Button 
                        size="small" 
                        href={discovery.source}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Source
                      </Button>
                    </Box>
                    {index < discoveries.length - 1 && <Divider sx={{ my: 2 }} />}
                  </Box>
                ))}
                {discoveries.length > 3 && (
                  <Box sx={{ textAlign: 'center', mt: 2 }}>
                    <Button 
                      variant="text" 
                      onClick={() => {
                        // Navigate to discoveries tab
                        const discoveriesTab = document.getElementById('project-tab-1');
                        if (discoveriesTab) {
                          discoveriesTab.click();
                        }
                      }}
                    >
                      View All {discoveries.length} Discoveries
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
};

export default ProjectSummary;