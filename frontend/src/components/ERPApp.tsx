import React from 'react';
import { Navigation } from './Navigation';
import { MasterForm } from './MasterForm';
import { Loader2 } from 'lucide-react';

interface MasterRecord {
  id: number;
  code: string;
  name: string;
}

const masterConfigs = {
  customers: { title: 'Customer', table: 'customers' },
  groups: { title: 'Group', table: 'groups_master' },
  leather: { title: 'Leather', table: 'leather' },
  styles: { title: 'Style', table: 'styles' },
  colors: { title: 'Color', table: 'colors' },
  work_centres: { title: 'Work Centre', table: 'work_centres' },
  machine_centres: { title: 'Machine Centre', table: 'machine_centres' },
};

export const ERPApp: React.FC = () => {
  const [activeMenu, setActiveMenu] = React.useState('customers');
  const [records, setRecords] = React.useState<MasterRecord[]>([]);
  const [loading, setLoading] = React.useState(false);

  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://shoe-factory-monitoring-production-8c06.up.railway.app';

  const fetchRecords = async (table: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/masters/${table}`);
      const result = await response.json();
      if (result.success) {
        setRecords(result.data);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const config = masterConfigs[activeMenu as keyof typeof masterConfigs];
    if (config) {
      fetchRecords(config.table);
    }
  }, [activeMenu]);

  const handleMenuClick = (menu: string) => {
    setActiveMenu(menu);
  };

  const handleRefresh = () => {
    const config = masterConfigs[activeMenu as keyof typeof masterConfigs];
    if (config) {
      fetchRecords(config.table);
    }
  };

  const currentConfig = masterConfigs[activeMenu as keyof typeof masterConfigs];

  return (
    <div className="flex h-screen bg-gray-100">
      <Navigation activeMenu={activeMenu} onMenuClick={handleMenuClick} />
      
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        ) : currentConfig ? (
          <MasterForm
            title={currentConfig.title}
            table={currentConfig.table}
            records={records}
            onRefresh={handleRefresh}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Select a menu item</p>
          </div>
        )}
      </div>
    </div>
  );
};