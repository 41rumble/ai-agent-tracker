import React, { useState } from 'react';
import {
  Box, Paper, Typography, Tabs, Tab, Divider, Grid, Card, CardContent,
  CardActions, Button, Chip, Rating, TextField, InputAdornment
} from '@mui/material';
import { Search as SearchIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';

interface GoalOrientedDiscoveriesProps {
  discoveries: any[];
  goals: string[];
  interests: string[];
}

// Helper function to group discoveries by goals/interests
const groupDiscoveriesByRelevance = (discoveries: any[], goals: string[], interests: string[]) => {
  // Create a map to store discoveries by goal/interest
  const groupedMap = new Map<string, any[]>();
  
  // Initialize with goals and interests
  [...goals, ...interests].forEach(item => {
    groupedMap.set(item, []);
  });
  
  // Add a group for unclassified discoveries
  groupedMap.set('Other Discoveries', []);
  
  // Group discoveries
  discoveries.forEach(discovery => {
    let assigned = false;
    
    // Check if discovery matches any goal or interest
    [...goals, ...interests].forEach(item => {
      const itemLower = item.toLowerCase();
      const matchesTitle = discovery.title.toLowerCase().includes(itemLower);
      const matchesDescription = discovery.description.toLowerCase().includes(itemLower);
      const matchesCategories = discovery.categories && Array.isArray(discovery.categories) && 
        discovery.categories.some((cat: string) => 
          cat.toLowerCase().includes(itemLower)
        );
      
      if (matchesTitle || matchesDescription || matchesCategories) {
        const existingDiscoveries = groupedMap.get(item) || [];
        groupedMap.set(item, [...existingDiscoveries, discovery]);
        assigned = true;
      }
    });
    
    // If not assigned to any goal/interest, add to "Other"
    if (!assigned) {
      const existingDiscoveries = groupedMap.get('Other Discoveries') || [];
      groupedMap.set('Other Discoveries', [...existingDiscoveries, discovery]);
    }
  });
  
  // Convert map to array and filter out empty groups
  return Array.from(groupedMap.entries())
    .filter(([_, groupDiscoveries]) => groupDiscoveries.length > 0)
    .map(([name, groupDiscoveries]) => ({
      name,
      discoveries: groupDiscoveries
    }));
};

const GoalOrientedDiscoveries: React.FC<GoalOrientedDiscoveriesProps> = ({ 
  discoveries, 
  goals, 
  interests 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  
  // Filter discoveries based on search term
  const filteredDiscoveries = discoveries.filter(d => 
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.categories && Array.isArray(d.categories) && d.categories.some((cat: string) => 
      cat.toLowerCase().includes(searchTerm.toLowerCase())
    ))
  );
  
  // Group discoveries by goals and interests
  const groupedDiscoveries = groupDiscoveriesByRelevance(
    filteredDiscoveries, 
    goals, 
    interests
  );
  
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Discoveries by Goal</Typography>
        <TextField
          placeholder="Search discoveries..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: 250 }}
        />
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {/* Tabs for each goal/interest group */}
      <Tabs 
        value={activeTab} 
        onChange={(_, newValue) => setActiveTab(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2 }}
      >
        {groupedDiscoveries.map((group, index) => (
          <Tab key={index} label={`${group.name} (${group.discoveries.length})`} />
        ))}
      </Tabs>
      
      {/* Discovery cards for the selected group */}
      {groupedDiscoveries.length > 0 ? (
        <Box>
          <Typography variant="h6" gutterBottom>
            {groupedDiscoveries[activeTab].name}
          </Typography>
          
          <Grid container spacing={3}>
            {groupedDiscoveries[activeTab].discoveries.map((discovery: any) => (
              <Grid item xs={12} md={6} lg={4} key={discovery._id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="h6" component="h2" gutterBottom>
                        {discovery.title}
                      </Typography>
                      <Chip 
                        label={discovery.type} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Rating
                        value={discovery.relevanceScore / 2}
                        precision={0.5}
                        readOnly
                        size="small"
                        max={5}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                        Relevance: {discovery.relevanceScore}/10
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {discovery.description && discovery.description.length > 150 
                        ? `${discovery.description.substring(0, 150)}...` 
                        : discovery.description || 'No description available'}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {discovery.categories && Array.isArray(discovery.categories) && 
                        discovery.categories.slice(0, 3).map((category: string, index: number) => (
                          <Chip key={index} label={category} size="small" />
                        ))
                      }
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button 
                      size="small" 
                      startIcon={<OpenInNewIcon />}
                      href={discovery.source}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Source
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : (
        <Typography variant="body1" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No discoveries found matching your search criteria.
        </Typography>
      )}
    </Paper>
  );
};

export default GoalOrientedDiscoveries;