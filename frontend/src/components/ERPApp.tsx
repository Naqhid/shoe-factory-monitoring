import React from 'react';
import { Layout } from './Layout';
import { MasterForm } from './MasterForm';
import { UsersMasterForm } from './UsersMasterForm';
import { EmployeeMasterForm } from './EmployeeMasterForm';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';

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

  const currentConfig = masterConfigs[activeMenu as keyof typeof masterConfigs];

  return (
    <Layout activeMenu={activeMenu}>
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
    </Layout>
  );
};