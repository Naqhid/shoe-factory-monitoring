import React from 'react';
import { ChevronDown, ChevronRight, Users, Layers, Package, Palette, Shirt, Settings, Cpu } from 'lucide-react';

interface NavigationProps {
  activeMenu: string;
  onMenuClick: (menu: string) => void;
}

const masterMenus = [
  { key: 'customers', label: 'Customer', icon: Users, table: 'customers' },
  { key: 'groups', label: 'Group', icon: Layers, table: 'groups_master' },
  { key: 'leather', label: 'Leather', icon: Package, table: 'leather' },
  { key: 'styles', label: 'Style', icon: Shirt, table: 'styles' },
  { key: 'colors', label: 'Color', icon: Palette, table: 'colors' },
  { key: 'work_centres', label: 'Work Centre', icon: Settings, table: 'work_centres' },
  { key: 'machine_centres', label: 'Machine Centre', icon: Cpu, table: 'machine_centres' },
];

export const Navigation: React.FC<NavigationProps> = ({ activeMenu, onMenuClick }) => {
  const [mastersExpanded, setMastersExpanded] = React.useState(true);

  return (
    <div className="w-64 bg-white shadow-lg h-full overflow-y-auto">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-800">ERP System</h2>
      </div>
      
      <nav className="p-4">
        {/* Masters Section */}
        <div className="mb-4">
          <button
            onClick={() => setMastersExpanded(!mastersExpanded)}
            className="flex items-center justify-between w-full text-left p-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            <span className="font-medium">Masters</span>
            {mastersExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          
          {mastersExpanded && (
            <div className="ml-4 mt-2 space-y-1">
              {masterMenus.map((menu) => {
                const Icon = menu.icon;
                return (
                  <button
                    key={menu.key}
                    onClick={() => onMenuClick(menu.key)}
                    className={`flex items-center w-full text-left p-2 rounded-md transition-colors ${
                      activeMenu === menu.key
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {menu.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};