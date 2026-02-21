import React from 'react';
import { Navigation } from './Navigation';
import { MasterForm } from './MasterForm';
import { UsersMasterForm } from './UsersMasterForm';
import { EmployeeMasterForm } from './EmployeeMasterForm';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL as API_BASE } from '../services/api';

interface MasterRecord {
  id: number;
  code: string;
  name: string;
  work_centre_id?: number;
  work_centre_name?: string;
  machine_id?: string;
}

const masterConfigs = {
  customers: { key: 'customers', title: 'Customer', table: 'customers' },
  groups: { key: 'groups', title: 'Group', table: 'groups_master' },
  leather: { key: 'leather', title: 'Leather', table: 'leather' },
  styles: { key: 'styles', title: 'Style', table: 'styles' },
  colors: { key: 'colors', title: 'Color', table: 'colors' },
  work_centres: { key: 'work_centres', title: 'Work Centre', table: 'work_centres' },
  machine_centres: { key: 'machine_centres', title: 'Machine Centre', table: 'machine_centres' },
  users: { key: 'users', title: 'User', table: 'users' },
  employees: { key: 'employees', title: 'Employee', table: 'employees' },
};

export const ERPApp: React.FC = () => {
  const [activeMenu, setActiveMenu] = React.useState('customers');
  const [records, setRecords] = React.useState<MasterRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);


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
    if (config && config.key !== 'users' && config.key !== 'employees') {
      fetchRecords(config.table);
    }
  }, [activeMenu]);

  const handleMenuClick = (menu: string) => {
    setActiveMenu(menu);
  };

  const handleRefresh = () => {
    const config = masterConfigs[activeMenu as keyof typeof masterConfigs];
    if (config && config.key !== 'users' && config.key !== 'employees') {
      fetchRecords(config.table);
    }
  };

  const currentConfig = masterConfigs[activeMenu as keyof typeof masterConfigs];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Navigation
        activeMenu={activeMenu}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className={`flex-1 overflow-auto ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        ) : currentConfig ? (
          currentConfig.key === 'users' ? (
            <UsersMasterForm />
          ) : currentConfig.key === 'employees' ? (
            <EmployeeMasterForm />
          ) : (
            <MasterForm
              title={currentConfig.title}
              table={currentConfig.table}
              records={records}
              onRefresh={handleRefresh}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Select a menu item</p>
          </div>
        )}
      </div>
    </div>
  );
};