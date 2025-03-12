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
  CardActions,
  Grid,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Badge,
  Checkbox,
  FormControlLabel,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { apiService } from '../../services/api';

interface NewDiscoveriesTabProps {
  projectId: string;
}

interface Discovery {
  _id: string;
  title: string;
  description: string;
  source: string;
  relevanceScore: number;
  categories: string[];
  type: string;
  discoveredAt: string;
  publicationDate: string;
  viewed: boolean;
  viewedAt?: string;
  hidden: boolean;
  userFeedback?: {
    useful?: boolean;
    notUseful?: boolean;
    relevance?: number;
    notes?: string;
    tags?: string[];
  };
  searchQueryUsed?: string;
}

interface DiscoveryCounts {
  total: number;
  new: number;
  viewed: number;
  hidden: number;
  useful: number;
  notUseful: number;
}

const NewDiscoveriesTab: React.FC<NewDiscoveriesTabProps> = ({ projectId }) => {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [counts, setCounts] = useState<DiscoveryCounts>({
    total: 0,
    new: 0,
    viewed: 0,
    hidden: 0,
    useful: 0,
    notUseful: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('new');
  const [sort, setSort] = useState('relevance');
  const [selectedDiscoveries, setSelectedDiscoveries] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionsMenuAnchor, setActionsMenuAnchor] = useState<null | HTMLElement>(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchDiscoveries();
  }, [projectId, filter, sort]);

  const fetchDiscoveries = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiService.getDiscoveries(projectId, filter, sort);
      
      if (response.data) {
        setDiscoveries(response.data.discoveries || []);
        setCounts(response.data.counts || {
          total: 0,
          new: 0,
          viewed: 0,
          hidden: 0,
          useful: 0,
          notUseful: 0
        });
      }
    } catch (err: any) {
      setError('Failed to load discoveries. Please try again.');
      console.error('Error fetching discoveries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setSelectedDiscoveries([]);
    setSelectAll(false);
    setFilterMenuAnchor(null);
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    setSortMenuAnchor(null);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectAll(event.target.checked);
    if (event.target.checked) {
      setSelectedDiscoveries(discoveries.map(d => d._id));
    } else {
      setSelectedDiscoveries([]);
    }
  };

  const handleSelectDiscovery = (id: string) => {
    if (selectedDiscoveries.includes(id)) {
      setSelectedDiscoveries(selectedDiscoveries.filter(d => d !== id));
      setSelectAll(false);
    } else {
      setSelectedDiscoveries([...selectedDiscoveries, id]);
      if (selectedDiscoveries.length + 1 === discoveries.length) {
        setSelectAll(true);
      }
    }
  };

  const handleMarkAsViewed = async (id: string) => {
    try {
      await apiService.markDiscoveryAsViewed(id);
      
      // Update the discovery in the local state
      setDiscoveries(discoveries.map(d => 
        d._id === id ? { ...d, viewed: true, viewedAt: new Date().toISOString() } : d
      ));
      
      // Update counts
      if (filter === 'new') {
        setCounts({
          ...counts,
          new: counts.new - 1,
          viewed: counts.viewed + 1
        });
      }
      
      setSuccessMessage('Discovery marked as viewed');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError('Failed to mark discovery as viewed');
      console.error('Error marking discovery as viewed:', err);
    }
  };

  const handleToggleHidden = async (id: string) => {
    try {
      const response = await apiService.toggleDiscoveryHidden(id);
      const isHidden = response.data.discovery.hidden;
      
      // Update the discovery in the local state
      setDiscoveries(discoveries.map(d => 
        d._id === id ? { ...d, hidden: isHidden } : d
      ));
      
      // Update counts
      setCounts({
        ...counts,
        hidden: isHidden ? counts.hidden + 1 : counts.hidden - 1,
        [filter]: counts[filter as keyof DiscoveryCounts] - 1
      });
      
      // If the discovery is now hidden and we're not in the hidden filter, remove it from the list
      if (isHidden && filter !== 'hidden') {
        setDiscoveries(discoveries.filter(d => d._id !== id));
      }
      
      setSuccessMessage(isHidden ? 'Discovery hidden' : 'Discovery unhidden');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError('Failed to toggle discovery hidden status');
      console.error('Error toggling discovery hidden status:', err);
    }
  };

  const handleBulkAction = async (action: string) => {
    try {
      setProcessingAction(true);
      
      await apiService.bulkUpdateDiscoveries(projectId, {
        ids: selectedDiscoveries,
        action
      });
      
      // Update the UI based on the action
      if (action === 'markViewed') {
        if (filter === 'new') {
          // If we're in the new filter, remove the viewed discoveries
          setDiscoveries(discoveries.filter(d => !selectedDiscoveries.includes(d._id)));
        } else {
          // Otherwise, update their status
          setDiscoveries(discoveries.map(d => 
            selectedDiscoveries.includes(d._id) 
              ? { ...d, viewed: true, viewedAt: new Date().toISOString() } 
              : d
          ));
        }
        
        // Update counts
        setCounts({
          ...counts,
          new: counts.new - selectedDiscoveries.length,
          viewed: counts.viewed + selectedDiscoveries.length
        });
        
        setSuccessMessage(`${selectedDiscoveries.length} discoveries marked as viewed`);
      } else if (action === 'hide') {
        // Remove the hidden discoveries from the current view if not in hidden filter
        if (filter !== 'hidden') {
          setDiscoveries(discoveries.filter(d => !selectedDiscoveries.includes(d._id)));
        }
        
        // Update counts
        setCounts({
          ...counts,
          hidden: counts.hidden + selectedDiscoveries.length,
          [filter]: counts[filter as keyof DiscoveryCounts] - selectedDiscoveries.length
        });
        
        setSuccessMessage(`${selectedDiscoveries.length} discoveries hidden`);
      } else if (action === 'unhide') {
        // If we're in the hidden filter, remove the unhidden discoveries
        if (filter === 'hidden') {
          setDiscoveries(discoveries.filter(d => !selectedDiscoveries.includes(d._id)));
        }
        
        // Update counts
        setCounts({
          ...counts,
          hidden: counts.hidden - selectedDiscoveries.length
        });
        
        setSuccessMessage(`${selectedDiscoveries.length} discoveries unhidden`);
      }
      
      // Reset selection
      setSelectedDiscoveries([]);
      setSelectAll(false);
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(`Failed to ${action} discoveries`);
      console.error(`Error performing bulk action ${action}:`, err);
    } finally {
      setProcessingAction(false);
      setActionsMenuAnchor(null);
    }
  };

  const handleMarkFeedback = async (id: string, isUseful: boolean) => {
    try {
      await apiService.updateDiscoveryFeedback(id, {
        userFeedback: {
          useful: isUseful,
          notUseful: !isUseful
        }
      });
      
      // Update the discovery in the local state
      setDiscoveries(discoveries.map(d => 
        d._id === id ? { 
          ...d, 
          userFeedback: {
            ...d.userFeedback,
            useful: isUseful,
            notUseful: !isUseful
          },
          viewed: true,
          viewedAt: d.viewedAt || new Date().toISOString()
        } : d
      ));
      
      // Update counts
      setCounts({
        ...counts,
        useful: isUseful ? counts.useful + 1 : counts.useful,
        notUseful: !isUseful ? counts.notUseful + 1 : counts.notUseful,
        new: d => d.viewed ? counts.new : counts.new - 1,
        viewed: d => d.viewed ? counts.viewed : counts.viewed + 1
      });
      
      setSuccessMessage(`Feedback saved: ${isUseful ? 'Useful' : 'Not Useful'}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError('Failed to save feedback');
      console.error('Error saving feedback:', err);
    }
  };

  const getDiscoveryTypeColor = (type: string) => {
    switch (type) {
      case 'Article': return 'primary';
      case 'Discussion': return 'secondary';
      case 'News': return 'info';
      case 'Research': return 'success';
      case 'Tool': return 'warning';
      default: return 'default';
    }
  };

  if (loading && discoveries.length === 0) {
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
            Discoveries
            {filter === 'new' && counts.new > 0 && (
              <Badge 
                badgeContent={counts.new} 
                color="error" 
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
              size="small"
            >
              {filter === 'new' ? 'New' : 
               filter === 'viewed' ? 'Viewed' : 
               filter === 'hidden' ? 'Hidden' : 
               filter === 'useful' ? 'Useful' : 
               filter === 'notUseful' ? 'Not Useful' : 'All'}
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<SortIcon />}
              onClick={(e) => setSortMenuAnchor(e.currentTarget)}
              size="small"
            >
              {sort === 'relevance' ? 'Relevance' : 
               sort === 'date' ? 'Date' : 
               sort === 'feedback' ? 'Feedback' : 'Sort'}
            </Button>
            
            {selectedDiscoveries.length > 0 && (
              <Button
                variant="contained"
                color="primary"
                onClick={(e) => setActionsMenuAnchor(e.currentTarget)}
                disabled={processingAction}
                size="small"
              >
                Actions ({selectedDiscoveries.length})
              </Button>
            )}
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip 
            label={`All (${counts.total})`} 
            onClick={() => handleFilterChange('all')}
            color={filter === 'all' ? 'primary' : 'default'}
            variant={filter === 'all' ? 'filled' : 'outlined'}
          />
          <Chip 
            label={`New (${counts.new})`} 
            onClick={() => handleFilterChange('new')}
            color={filter === 'new' ? 'primary' : 'default'}
            variant={filter === 'new' ? 'filled' : 'outlined'}
          />
          <Chip 
            label={`Viewed (${counts.viewed})`} 
            onClick={() => handleFilterChange('viewed')}
            color={filter === 'viewed' ? 'primary' : 'default'}
            variant={filter === 'viewed' ? 'filled' : 'outlined'}
          />
          <Chip 
            label={`Hidden (${counts.hidden})`} 
            onClick={() => handleFilterChange('hidden')}
            color={filter === 'hidden' ? 'primary' : 'default'}
            variant={filter === 'hidden' ? 'filled' : 'outlined'}
          />
          <Chip 
            label={`Useful (${counts.useful})`} 
            onClick={() => handleFilterChange('useful')}
            color={filter === 'useful' ? 'primary' : 'default'}
            variant={filter === 'useful' ? 'filled' : 'outlined'}
          />
          <Chip 
            label={`Not Useful (${counts.notUseful})`} 
            onClick={() => handleFilterChange('notUseful')}
            color={filter === 'notUseful' ? 'primary' : 'default'}
            variant={filter === 'notUseful' ? 'filled' : 'outlined'}
          />
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}
        
        {discoveries.length > 0 ? (
          <>
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectAll}
                    onChange={handleSelectAll}
                    color="primary"
                  />
                }
                label={`Select All (${discoveries.length})`}
              />
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {discoveries.map((discovery) => (
                <Card 
                  key={discovery._id} 
                  variant="outlined"
                  sx={{ 
                    borderLeft: discovery.viewed ? '4px solid #e0e0e0' : '4px solid #2196f3',
                    opacity: discovery.hidden ? 0.7 : 1
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                      <Checkbox
                        checked={selectedDiscoveries.includes(discovery._id)}
                        onChange={() => handleSelectDiscovery(discovery._id)}
                        sx={{ mt: -1, ml: -1 }}
                      />
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Typography variant="h6" component="h3" gutterBottom>
                            {discovery.title}
                            {!discovery.viewed && (
                              <Chip 
                                label="New" 
                                size="small" 
                                color="primary" 
                                sx={{ ml: 1 }} 
                              />
                            )}
                          </Typography>
                          <Box>
                            <Chip 
                              label={discovery.type} 
                              size="small" 
                              color={getDiscoveryTypeColor(discovery.type)} 
                              sx={{ mr: 1 }} 
                            />
                            <Chip 
                              label={`Relevance: ${discovery.relevanceScore}/10`} 
                              size="small" 
                              color={
                                discovery.relevanceScore >= 8 ? 'success' :
                                discovery.relevanceScore >= 5 ? 'primary' : 'default'
                              } 
                            />
                          </Box>
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {discovery.description}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                          {discovery.categories.map((category, index) => (
                            <Chip 
                              key={index} 
                              label={category} 
                              size="small" 
                              variant="outlined" 
                            />
                          ))}
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            Discovered: {new Date(discovery.discoveredAt).toLocaleString()}
                            {discovery.searchQueryUsed && (
                              <Tooltip title="Search query used">
                                <Chip 
                                  label={discovery.searchQueryUsed} 
                                  size="small" 
                                  variant="outlined" 
                                  sx={{ ml: 1 }} 
                                />
                              </Tooltip>
                            )}
                          </Typography>
                          
                          <Box>
                            <Button 
                              size="small" 
                              href={discovery.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="outlined"
                              sx={{ mr: 1 }}
                            >
                              View Source
                            </Button>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                  
                  <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                    <Tooltip title={discovery.userFeedback?.useful ? "Marked as useful" : "Mark as useful"}>
                      <IconButton 
                        color={discovery.userFeedback?.useful ? "success" : "default"}
                        onClick={() => handleMarkFeedback(discovery._id, true)}
                      >
                        <ThumbUpIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title={discovery.userFeedback?.notUseful ? "Marked as not useful" : "Mark as not useful"}>
                      <IconButton 
                        color={discovery.userFeedback?.notUseful ? "error" : "default"}
                        onClick={() => handleMarkFeedback(discovery._id, false)}
                      >
                        <ThumbDownIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title={discovery.viewed ? "Already viewed" : "Mark as viewed"}>
                      <IconButton 
                        color={discovery.viewed ? "primary" : "default"}
                        onClick={() => handleMarkAsViewed(discovery._id)}
                        disabled={discovery.viewed}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title={discovery.hidden ? "Unhide" : "Hide"}>
                      <IconButton 
                        color={discovery.hidden ? "warning" : "default"}
                        onClick={() => handleToggleHidden(discovery._id)}
                      >
                        {discovery.hidden ? <VisibilityIcon /> : <VisibilityOffIcon />}
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              ))}
            </Box>
          </>
        ) : (
          <Alert severity="info">
            {filter === 'new' 
              ? "No new discoveries found. All discoveries have been viewed."
              : filter === 'hidden'
              ? "No hidden discoveries found."
              : filter === 'useful'
              ? "No discoveries marked as useful yet."
              : filter === 'notUseful'
              ? "No discoveries marked as not useful yet."
              : "No discoveries found for this project."}
          </Alert>
        )}
      </Paper>
      
      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleFilterChange('all')}>
          <ListItemText primary="All Discoveries" />
        </MenuItem>
        <MenuItem onClick={() => handleFilterChange('new')}>
          <ListItemText primary="New" secondary={`${counts.new} discoveries`} />
        </MenuItem>
        <MenuItem onClick={() => handleFilterChange('viewed')}>
          <ListItemText primary="Viewed" secondary={`${counts.viewed} discoveries`} />
        </MenuItem>
        <MenuItem onClick={() => handleFilterChange('hidden')}>
          <ListItemText primary="Hidden" secondary={`${counts.hidden} discoveries`} />
        </MenuItem>
        <MenuItem onClick={() => handleFilterChange('useful')}>
          <ListItemText primary="Useful" secondary={`${counts.useful} discoveries`} />
        </MenuItem>
        <MenuItem onClick={() => handleFilterChange('notUseful')}>
          <ListItemText primary="Not Useful" secondary={`${counts.notUseful} discoveries`} />
        </MenuItem>
      </Menu>
      
      {/* Sort Menu */}
      <Menu
        anchorEl={sortMenuAnchor}
        open={Boolean(sortMenuAnchor)}
        onClose={() => setSortMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleSortChange('relevance')}>
          <ListItemText primary="Relevance" secondary="Most relevant first" />
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('date')}>
          <ListItemText primary="Date" secondary="Most recent first" />
        </MenuItem>
        <MenuItem onClick={() => handleSortChange('feedback')}>
          <ListItemText primary="Feedback" secondary="Based on user feedback" />
        </MenuItem>
      </Menu>
      
      {/* Actions Menu */}
      <Menu
        anchorEl={actionsMenuAnchor}
        open={Boolean(actionsMenuAnchor)}
        onClose={() => setActionsMenuAnchor(null)}
      >
        <MenuItem 
          onClick={() => handleBulkAction('markViewed')}
          disabled={processingAction}
        >
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Mark as Viewed" />
        </MenuItem>
        <MenuItem 
          onClick={() => handleBulkAction('markUnviewed')}
          disabled={processingAction}
        >
          <ListItemIcon>
            <VisibilityOffIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Mark as Unviewed" />
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => handleBulkAction('hide')}
          disabled={processingAction}
        >
          <ListItemIcon>
            <ArchiveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Hide" />
        </MenuItem>
        <MenuItem 
          onClick={() => handleBulkAction('unhide')}
          disabled={processingAction}
        >
          <ListItemIcon>
            <UnarchiveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Unhide" />
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default NewDiscoveriesTab;