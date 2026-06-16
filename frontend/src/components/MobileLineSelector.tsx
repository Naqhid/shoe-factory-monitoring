import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Factory, Loader2 } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';
import { getDefaultRoute, getEffectiveRole, isMenuAllowed } from '../utils/roleConfig';

interface MachineEntry {
  id: number;
  machine_id: string;
  name: string;
  machine_name: string | null;
  work_centre_name: string | null;
}

export const MobileLineSelector: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [machines, setMachines] = useState<MachineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<string[]>([]);
  const [selectedLine, setSelectedLine] = useState<string>('');

  useEffect(() => {
    const userInfo = localStorage.getItem('user_info');
    const user = userInfo ? JSON.parse(userInfo) : null;

    if (!isMenuAllowed('mobile', user)) {
      navigate(getDefaultRoute(user), { replace: true });
      return;
    }

    if (getEffectiveRole(user) === 'Machine Centre User' && user?.machine_id) {
      navigate(
        `/mobile/${encodeURIComponent(user.machine_id)}/${encodeURIComponent(user.code)}`,
        { replace: true }
      );
      return;
    }

    apiFetch(`${API_BASE_URL}/api/masters/machine_centres?limit=100`)
      .then(r => r.json())
      .then(result => {
        if (result.success) {
          const valid = result.data
            .filter((m: any) => m.machine_id)
            .sort((a: any, b: any) => a.machine_id.localeCompare(b.machine_id));
          setMachines(valid);
          const uniqueLines = Array.from(
            new Set(valid.map((m: any) => m.work_centre_name).filter(Boolean))
          ) as string[];
          setLines(uniqueLines.sort());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigate]);

  // Pre-select line from ?line= query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const lineParam = params.get('line');
    if (lineParam) setSelectedLine(lineParam);
  }, [location.search]);

  const userInfo = localStorage.getItem('user_info');
  const user = userInfo ? JSON.parse(userInfo) : null;
  if (!isMenuAllowed('mobile', user)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const filteredMachines = selectedLine
    ? machines.filter(m => m.work_centre_name === selectedLine)
    : machines;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center mb-6">
          <Factory className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Production Line</h1>
          <p className="text-gray-500">Choose a machine to access mobile production</p>
        </div>

        {lines.length > 0 && (
          <div className="mb-4">
            <select
              value={selectedLine}
              onChange={e => setSelectedLine(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Lines</option>
              {lines.map(line => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMachines.map((machine) => (
              <Link
                key={machine.id}
                to={`/mobile/${encodeURIComponent(machine.machine_id)}`}
                className="block bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition-shadow border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 p-3 rounded-full">
                      <Factory className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-base font-semibold text-gray-900">
                        {machine.machine_name || machine.name}
                      </h3>
                      <p className="text-sm text-gray-500">Machine: {machine.machine_id}</p>
                      {machine.work_centre_name && (
                        <p className="text-xs text-gray-400">{machine.work_centre_name}</p>
                      )}
                    </div>
                  </div>
                  <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
            {filteredMachines.length === 0 && (
              <p className="text-center text-gray-400 py-8">No machines found for this line.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
