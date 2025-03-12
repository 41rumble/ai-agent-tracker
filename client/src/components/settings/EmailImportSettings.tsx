import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Switch,
  FormControlLabel, Button, Alert, CircularProgress,
  Divider, List, ListItem, ListItemText, IconButton
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { apiService } from '../../services/api';

const EmailImportSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    enabled: false,
    sources: [] as string[]
  });
  
  const [newSource, setNewSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  useEffect(() => {
    // Load existing settings
    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await apiService.getEmailImportSettings();
        
        if (response.data && response.data.settings) {
          setSettings(response.data.settings);
        }
      } catch (err: any) {
        setError('Failed to load email settings: ' + (err.message || 'Unknown error'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  const handleToggleEnabled = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      enabled: event.target.checked
    });
  };
  
  const handleAddSource = () => {
    if (!newSource.trim()) return;
    
    if (!newSource.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (settings.sources.includes(newSource)) {
      setError('This source is already in the list');
      return;
    }
    
    setSettings({
      ...settings,
      sources: [...settings.sources, newSource]
    });
    
    setNewSource('');
    setError('');
  };
  
  const handleRemoveSource = (index: number) => {
    const newSources = [...settings.sources];
    newSources.splice(index, 1);
    
    setSettings({
      ...settings,
      sources: newSources
    });
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      await apiService.updateEmailImportSettings(settings);
      
      setSuccess('Email import settings saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('Failed to save settings: ' + (err.message || 'Unknown error'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };
  
  const handleCheckEmails = async () => {
    try {
      setChecking(true);
      setError('');
      
      const response = await apiService.runEmailImportCheck();
      
      setSuccess(response.data.message || 'Email check completed successfully');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError('Failed to check emails: ' + (err.message || 'Unknown error'));
      console.error(err);
    } finally {
      setChecking(false);
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Newsletter Email Import Settings
      </Typography>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        Configure automatic import of newsletters from your email account. The system will check for new emails from the specified sources and process them into discoveries.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      
      <Box sx={{ mt: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={settings.enabled}
              onChange={handleToggleEnabled}
              name="enabled"
            />
          }
          label="Enable automatic newsletter import from email"
        />
        
        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
          Newsletter Sources
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Add email addresses of newsletter senders you want to import. Only emails from these addresses will be processed.
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Newsletter Email Address"
            placeholder="newsletter@example.com"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            disabled={!settings.enabled}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSource}
            disabled={!settings.enabled || !newSource.trim()}
          >
            Add
          </Button>
        </Box>
        
        <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', mb: 3 }}>
          <List dense>
            {settings.sources.length === 0 ? (
              <ListItem>
                <ListItemText 
                  primary="No sources added yet" 
                  secondary="Add newsletter email addresses above" 
                />
              </ListItem>
            ) : (
              settings.sources.map((source, index) => (
                <ListItem
                  key={index}
                  secondaryAction={
                    <IconButton 
                      edge="end" 
                      aria-label="delete"
                      onClick={() => handleRemoveSource(index)}
                      disabled={!settings.enabled}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText primary={source} />
                </ListItem>
              ))
            )}
          </List>
        </Paper>
        
        <Divider sx={{ my: 3 }} />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !settings.enabled}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleCheckEmails}
            disabled={checking || !settings.enabled}
          >
            {checking ? 'Checking...' : 'Check Emails Now'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default EmailImportSettings;