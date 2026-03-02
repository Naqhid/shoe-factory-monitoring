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
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const currentConfig = masterConfigs[activeMenu as keyof typeof masterConfigs];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Navigation
        activeMenu={activeMenu}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className={`flex-1 overflow-auto ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        {currentConfig ? (
          currentConfig.key === 'users' ? (
            <UsersMasterForm />
          ) : currentConfig.key === 'employees' ? (
            <EmployeeMasterForm />
          ) : (
            <MasterForm
              title={currentConfig.title}
              table={currentConfig.table}
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