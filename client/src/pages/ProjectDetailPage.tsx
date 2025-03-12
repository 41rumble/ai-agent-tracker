import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Tabs, Tab } from '@mui/material';
import ProjectDetail from '../components/projects/ProjectDetail';
import UnifiedProjectDashboard from '../components/dashboard/UnifiedProjectDashboard';

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
      id={`project-view-tabpanel-${index}`}
      aria-labelledby={`project-view-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box>
          {children}
        </Box>
      )}
    </div>
  );
}

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [viewMode, setViewMode] = useState(0);

  const handleChangeView = (event: React.SyntheticEvent, newValue: number) => {
    setViewMode(newValue);
  };

  if (!id) {
    return <div>Project ID not found</div>;
  }

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={viewMode} 
          onChange={handleChangeView} 
          aria-label="project view mode"
          centered
        >
          <Tab label="Dashboard View" id="project-view-tab-0" aria-controls="project-view-tabpanel-0" />
          <Tab label="Classic View" id="project-view-tab-1" aria-controls="project-view-tabpanel-1" />
        </Tabs>
      </Box>
      
      <TabPanel value={viewMode} index={0}>
        <UnifiedProjectDashboard projectId={id} />
      </TabPanel>
      
      <TabPanel value={viewMode} index={1}>
        <ProjectDetail />
      </TabPanel>
    </Box>
  );
};

export default ProjectDetailPage;