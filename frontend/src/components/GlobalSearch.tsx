import React, { useState, useEffect, useRef } from 'react';
import { Search, X, User, Users, Package, Shirt, Palette, Settings, Cpu, Shield, Building2, Route, Calendar, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';

interface SearchResult {
  id: number;
  code: string;
  name: string;
  type: string;
  route: string;
}

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
};

export const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setIsLoading(true);
        try {
          const response = await apiFetch(`/api/global-search?q=${encodeURIComponent(query)}&limit=10`);
          const data = await response.json();
          if (data.success) {
            setResults(data.data);
          }
        } catch (error) {
          console.error('Search error:', error);
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    navigate(`${result.route}`);
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
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
          className="w-64 pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
              <span className="ml-2">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result) => {
                const Icon = typeIcons[result.type] || Search;
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="w-full px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-left transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                      <Icon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">{result.name}</span>
                        <span className="text-xs text-gray-500">({result.code})</span>
                      </div>
                      <div className="text-xs text-gray-500 capitalize">{typeLabels[result.type] || result.type}</div>
                    </div>
                  </button>
                );
              })}
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
