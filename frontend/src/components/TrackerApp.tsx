import React from 'react';
import { Play, Square, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';

export const TrackerApp: React.FC = () => {
  const navigate = useNavigate();
  const [machineId, setMachineId] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'running'>('idle');
  const [loading, setLoading] = React.useState(false);


  const handleStatusChange = async (newStatus: 0 | 1) => {
    if (!machineId.trim()) {
      toast.error('Please enter machine ID');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/api/manual-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: machineId,
          status: newStatus,
          source: 'tracker_app'
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus(newStatus === 1 ? 'running' : 'idle');
        toast.success(`Machine ${newStatus === 1 ? 'started' : 'stopped'}`);
      } else {
        toast.error(result.error || 'Failed to update status');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-gray-700" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Work Tracker</h1>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-4">
            {/* Machine ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Machine ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., US-01"
              />
            </div>

            {/* Status Display */}
            <div className="text-center py-4">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${status === 'running'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
                }`}>
                <div className={`w-3 h-3 rounded-full ${status === 'running' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                {status === 'running' ? 'Running' : 'Idle'}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => handleStatusChange(1)}
                disabled={loading || status === 'running'}
                className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="h-5 w-5" />
                Start
              </button>
              <button
                onClick={() => handleStatusChange(0)}
                disabled={loading || status === 'idle'}
                className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base flex items-center justify-center gap-2 transition-colors"
              >
                <Square className="h-5 w-5" />
                Stop
              </button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Instructions</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Enter your machine ID</li>
            <li>• Press "Start" when beginning work</li>
            <li>• Press "Stop" when finishing work</li>
            <li>• Status will be logged automatically</li>
          </ul>
        </div>
      </div>
    </div>
  );
};