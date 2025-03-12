import React, { useState, useEffect } from 'react';
import { Box, Container, Grid, CircularProgress, Alert } from '@mui/material';
import ProjectHeader from './ProjectHeader';
import ProjectInsights from './ProjectInsights';
import GoalOrientedDiscoveries from './GoalOrientedDiscoveries';
import ProjectTimeline from './ProjectTimeline';
import ContextPanel from './ContextPanel';
import { apiService } from '../../services/api';

interface UnifiedProjectDashboardProps {
  projectId: string;
}

const UnifiedProjectDashboard: React.FC<UnifiedProjectDashboardProps> = ({ projectId }) => {
  const [project, setProject] = useState<any>(null);
  const [discoveries, setDiscoveries] = useState<any[]>([]);
  const [context, setContext] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // UI state
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  
  // Fetch all required data in parallel
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        // Fetch data in parallel
        const [
          projectResponse, 
          discoveriesResponse, 
          contextResponse
        ] = await Promise.all([
          apiService.getProject(projectId),
          apiService.getDiscoveries(projectId, 'all', 'relevance'),
          apiService.getProjectContext(projectId)
        ]);
        
        setProject(projectResponse.data);
        
        // Handle different response formats for discoveries
        if (discoveriesResponse.data && discoveriesResponse.data.discoveries) {
          setDiscoveries(discoveriesResponse.data.discoveries);
        } else {
          setDiscoveries(discoveriesResponse.data || []);
        }
        
        setContext(contextResponse.data.context);
        
        // Try to get summary from localStorage first
        const storedSummary = localStorage.getItem(`project_summary_${projectId}`);
        if (storedSummary) {
          try {
            const parsedSummary = JSON.parse(storedSummary);
            setSummary(parsedSummary);
          } catch (err) {
            console.error('Error parsing stored summary:', err);
            // If parsing fails, fetch from API
            fetchSummary();
          }
        } else {
          // No stored summary, fetch from API
          fetchSummary();
        }
        
        setError('');
      } catch (err: any) {
        setError('Failed to load project dashboard. Please try again.');
        console.error('Error fetching project dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllData();
  }, [projectId]);
  
  const fetchSummary = async () => {
    try {
      const summaryResponse = await apiService.getRecommendations(projectId);
      setSummary(summaryResponse.data);
    } catch (err: any) {
      console.error('Error fetching summary:', err);
    }
  };
  
  const handleTriggerSearch = async () => {
    try {
      setIsSearching(true);
      setSuccessMessage('');
      
      // Trigger search
      const searchResponse = await apiService.triggerSearch(projectId, false);
      
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
      
      // Show success message
      setSuccessMessage(
        searchResponse.data.message || 
        'Search triggered successfully! The system is now searching for new information in the background.'
      );
      
      // Refresh discoveries after a short delay
      setTimeout(async () => {
        try {
          const discoveriesResponse = await apiService.getDiscoveries(projectId, 'all', 'relevance');
          
          if (discoveriesResponse.data && discoveriesResponse.data.discoveries) {
            setDiscoveries(discoveriesResponse.data.discoveries);
          } else {
            setDiscoveries(discoveriesResponse.data || []);
          }
        } catch (err) {
          console.error('Error refreshing discoveries:', err);
        } finally {
          setIsSearching(false);
        }
      }, 3000);
      
    } catch (err: any) {
      setError('Failed to trigger search. Please try again.');
      console.error('Error triggering search:', err);
      setIsSearching(false);
    }
  };
  
  const handleRefreshSummary = async () => {
    try {
      setIsGeneratingSummary(true);
      setSuccessMessage('');
      
      // Generate new summary
      const response = await apiService.getRecommendations(projectId);
      
      if (response.data && response.data.summary) {
        setSummary(response.data);
        
        // Store the summary in localStorage
        const summaryData = {
          ...response.data,
          lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(`project_summary_${projectId}`, JSON.stringify(summaryData));
        
        setSuccessMessage('Project insights updated successfully!');
      }
    } catch (err: any) {
      setError('Failed to generate summary. Please try again.');
      console.error('Error generating summary:', err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };
  
  const handleSubmitUpdate = async (update: string) => {
    try {
      setIsSubmittingUpdate(true);
      setSuccessMessage('');
      
      // Check if there's a recent question to respond to
      const recentQuestion = context?.contextEntries
        ?.filter((entry: any) => entry.type === 'agent_question')
        ?.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      
      let response;
      
      if (recentQuestion) {
        // Submit as a response to the current question
        response = await apiService.addUserResponse(
          projectId, 
          recentQuestion._id, 
          update
        );
      } else {
        // Submit as a general update
        response = await apiService.addUserUpdate(projectId, update);
      }
      
      // Update context with the new data
      setContext(response.data.context);
      setSuccessMessage('Update submitted successfully!');
    } catch (err: any) {
      setError('Failed to submit update. Please try again.');
      console.error('Error submitting update:', err);
    } finally {
      setIsSubmittingUpdate(false);
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
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 6 }}>
        {/* Success/Error Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        
        {successMessage && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage('')}>
            {successMessage}
          </Alert>
        )}
        
        {/* Project Header */}
        <ProjectHeader 
          project={project} 
          discoveryStats={{
            total: discoveries.length,
            new: discoveries.filter(d => !d.viewed).length,
            useful: discoveries.filter(d => d.userFeedback?.useful).length
          }}
          onTriggerSearch={handleTriggerSearch}
          isSearching={isSearching}
        />
        
        {/* Main Content Grid */}
        <Grid container spacing={3}>
          {/* Left Column - 2/3 width */}
          <Grid item xs={12} lg={8}>
            {/* Project Insights Panel */}
            <ProjectInsights 
              summary={summary} 
              project={project}
              onRefresh={handleRefreshSummary}
              isGenerating={isGeneratingSummary}
            />
            
            {/* Goal-Oriented Discoveries */}
            <GoalOrientedDiscoveries 
              discoveries={discoveries} 
              goals={project?.goals || []}
              interests={project?.interests || []}
            />
          </Grid>
          
          {/* Right Column - 1/3 width */}
          <Grid item xs={12} lg={4}>
            {/* Context Panel */}
            <ContextPanel 
              context={context}
              onSubmitUpdate={handleSubmitUpdate}
              isSubmitting={isSubmittingUpdate}
            />
            
            {/* Project Timeline */}
            <ProjectTimeline 
              milestones={project?.currentState?.milestones || []}
              discoveries={discoveries}
              contextEntries={context?.contextEntries || []}
            />
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default UnifiedProjectDashboard;