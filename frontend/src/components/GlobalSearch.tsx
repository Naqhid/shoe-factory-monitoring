import React, { useState, useEffect, useRef } from 'react';
import { Search, X, User, Users, Package, Shirt, Palette, Settings, Cpu, Shield, Building2, Route, Calendar, AlertTriangle, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';

interface SearchResult {
  id: number;
  code: string;
  name: string;
  type: string;
  route: string;
}

interface GlobalSearchProps {
  onSearchChange?: (query: string) => void;
}

const menuItems = [
  { key: 'overview', label: 'TV Dashboard', route: '/overview', type: 'menu' },
  { key: 'reports', label: 'Reports', route: '/reports', type: 'menu' },
  { key: 'missed_actions', label: 'Missed Actions', route: '/missed_actions', type: 'menu' },
  { key: 'alert_center', label: 'Alert Center', route: '/alert_center', type: 'menu' },
  { key: 'logs', label: 'Login Logs', route: '/logs', type: 'menu' },
  { key: 'production_routing', label: 'Routing', route: '/production_routing', type: 'menu' },
  { key: 'production_planning', label: 'Planning', route: '/production_planning', type: 'menu' },
  { key: 'line_schedule', label: 'Line Schedule', route: '/line_schedule', type: 'menu' },
  { key: 'line_setup_form', label: 'Line Setup', route: '/line_setup', type: 'menu' },
  { key: 'manual_production_entry', label: 'Manual Entry', route: '/manual_production_entry', type: 'menu' },
  { key: 'production_tracker', label: 'Production Tracker', route: '/production_tracker', type: 'menu' },
  { key: 'rework_rejection_tracker', label: 'Rework / Rejection Tracker', route: '/rework_rejection_tracker', type: 'menu' },
  { key: 'mobile', label: 'Line Monitor', route: '/mobile', type: 'menu' },
  { key: 'customers', label: 'Customer', route: '/customers', type: 'menu' },
  { key: 'groups', label: 'Group', route: '/groups', type: 'menu' },
  { key: 'leather', label: 'Leather', route: '/leather', type: 'menu' },
  { key: 'styles', label: 'Style', route: '/styles', type: 'menu' },
  { key: 'colors', label: 'Color', route: '/colors', type: 'menu' },
  { key: 'work_centres', label: 'Work Centre', route: '/work_centres', type: 'menu' },
  { key: 'machine_centres', label: 'Machine Centre', route: '/machine_centres', type: 'menu' },
  { key: 'employees', label: 'Employee', route: '/employees', type: 'menu' },
  { key: 'users', label: 'Users', route: '/users', type: 'menu' },
  { key: 'roles', label: 'Roles', route: '/roles', type: 'menu' },
  { key: 'monitoring', label: 'Monitoring', route: '/monitoring', type: 'menu' },
];

const typeIcons: { [key: string]: React.ElementType } = {
  customer: Building2,
  group: Users,
  leather: Package,
  style: Shirt,
  color: Palette,
  work_centre: Settings,
  machine_centre: Cpu,
  employee: User,
  user: User,
  role: Shield,
  production_routing: Route,
  production_plan: Calendar,
  production_alert: AlertTriangle,
  menu: Activity,
};

const typeLabels: { [key: string]: string } = {
  customer: 'Customer',
  group: 'Group',
  leather: 'Leather',
  style: 'Style',
  color: 'Color',
  work_centre: 'Work Centre',
  machine_centre: 'Machine Centre',
  employee: 'Employee',
  user: 'User',
  role: 'Role',
  production_routing: 'Production Routing',
  production_plan: 'Production Plan',
  production_alert: 'Production Alert',
  menu: 'Menu',
};

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onSearchChange }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setIsLoading(true);
        try {
          const response = await apiFetch(`/api/global-search?q=${encodeURIComponent(query)}&limit=10`);
          const data = await response.json();
          if (data.success) {
            // Combine database results with matching menu items
            const dbResults = data.data;
            const searchLower = query.toLowerCase();
            const matchingMenuItems = menuItems
              .filter(item =>
                item.label.toLowerCase().includes(searchLower) ||
                item.key.toLowerCase().includes(searchLower)
              )
              .map(item => ({
                id: -1, // Use negative ID for menu items
                code: item.key,
                name: item.label,
                type: 'menu',
                route: item.route
              }));

            // Combine results, prioritizing database results
            const combinedResults = [...dbResults, ...matchingMenuItems];
            setResults(combinedResults);
            setSelectedIndex(-1); // Reset selection when results change
          }
        } catch (error) {
          console.error('Search error:', error);
          // Fallback to menu items only if API fails
          const searchLower = query.toLowerCase();
          const matchingMenuItems = menuItems
            .filter(item =>
              item.label.toLowerCase().includes(searchLower) ||
              item.key.toLowerCase().includes(searchLower)
            )
            .map(item => ({
              id: -1,
              code: item.key,
              name: item.label,
              type: 'menu',
              route: item.route
            }));
          setResults(matchingMenuItems);
          setSelectedIndex(-1);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
        setSelectedIndex(-1);
      }
      // Notify parent of search query change
      if (onSearchChange) {
        onSearchChange(query);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query, onSearchChange]);

  const handleResultClick = (result: SearchResult) => {
    navigate(`${result.route}`);
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < results.length) {
      e.preventDefault();
      handleResultClick(results[selectedIndex]);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search everything..."
          className="w-48 pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
              <span className="ml-2">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {(() => {
                // Group results by type
                const grouped = results.reduce((acc, result, index) => {
                  const type = result.type;
                  if (!acc[type]) {
                    acc[type] = [];
                  }
                  acc[type].push({ ...result, originalIndex: index });
                  return acc;
                }, {} as Record<string, (SearchResult & { originalIndex: number })[]>);

                return Object.entries(grouped).map(([type, typeResults]) => (
                  <div key={type}>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      {typeLabels[type] || type}
                    </div>
                    {typeResults.map((result) => {
                      const Icon = typeIcons[result.type] || Search;
                      const isSelected = result.originalIndex === selectedIndex;
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleResultClick(result)}
                          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                            <Icon className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 truncate">{highlightMatch(result.name, query)}</span>
                              <span className="text-xs text-gray-500">({highlightMatch(result.code, query)})</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          ) : query.length >= 2 ? (
            <div className="p-4 text-center text-gray-500">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  );
};
