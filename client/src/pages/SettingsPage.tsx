import React, { useState } from 'react';
import {
  Container, Typography, Box, Tabs, Tab, Paper
} from '@mui/material';
import EmailImportSettings from '../components/settings/EmailImportSettings';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SettingsPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 6 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Settings
        </Typography>
        
        <Paper sx={{ mt: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              aria-label="settings tabs"
            >
              <Tab label="Email Import" id="settings-tab-0" aria-controls="settings-tabpanel-0" />
              <Tab label="Account" id="settings-tab-1" aria-controls="settings-tabpanel-1" />
              <Tab label="Notifications" id="settings-tab-2" aria-controls="settings-tabpanel-2" />
            </Tabs>
          </Box>
          
          <TabPanel value={tabValue} index={0}>
            <EmailImportSettings />
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6">Account Settings</Typography>
            <Typography variant="body1" color="text.secondary">
              Account settings will be implemented in a future update.
            </Typography>
          </TabPanel>
          
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6">Notification Settings</Typography>
            <Typography variant="body1" color="text.secondary">
              Notification settings will be implemented in a future update.
            </Typography>
          </TabPanel>
        </Paper>
      </Box>
    </Container>
  );
};

export default SettingsPage;