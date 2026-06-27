import React, { useState, useEffect } from 'react';
import { Calendar, Building, Cpu } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../services/api';
import { getEffectiveRole } from '../utils/roleConfig';
import { StoppageEntryTab } from './StoppageEntryTab';
import { ReworkRejectionEntryTab } from './ReworkRejectionEntryTab';

interface WorkCentre {
  id: number;
  name: string;
}

interface MachineCentre {
  id: number;
  name: string;
  machine_id: string;
}

export const ReworkRejectionTrackerPage: React.FC = () => {
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
  const effectiveRole = getEffectiveRole(userInfo);
  const isSupervisor = effectiveRole === 'Line Supervisor';
  const canEditRework = effectiveRole === 'Admin' || effectiveRole === 'Line Supervisor' || effectiveRole === 'Quality' || effectiveRole === 'Project Monitor';
  const canDeleteRework = effectiveRole === 'Admin';
  const supervisorWorkCentreId = userInfo?.work_centre_id ? String(userInfo.work_centre_id) : '';

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const [workCentres, setWorkCentres] = useState<WorkCentre[]>([]);
  const [machineCentres, setMachineCentres] = useState<MachineCentre[]>([]);
  const [selectedWorkCentre, setSelectedWorkCentre] = useState(isSupervisor ? supervisorWorkCentreId : '');
  const [selectedMachineCentre, setSelectedMachineCentre] = useState('');
  const [activeTab, setActiveTab] = useState<'rework_rejection' | 'breakdown'>('rework_rejection');

  const effectiveWorkCentreId = isSupervisor ? supervisorWorkCentreId : selectedWorkCentre;
  const workCentreDisplayName = effectiveWorkCentreId
    ? isSupervisor
      ? String(userInfo?.work_centre_name || supervisorWorkCentreId)
      : workCentres.find((wc) => String(wc.id) === effectiveWorkCentreId)?.name || 'selected work centre'
    : '';

  useEffect(() => {
    const fetchWorkCentres = async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/masters/work_centres`);
        const result = await response.json();
        if (result.success) setWorkCentres(result.data);
      } catch (error) {
        console.error('Error fetching work centres:', error);
      }
    };
    fetchWorkCentres();
  }, []);

  useEffect(() => {
    if (isSupervisor && supervisorWorkCentreId && workCentres.length > 0) {
      setSelectedWorkCentre(supervisorWorkCentreId);
    }
  }, [workCentres]);

  useEffect(() => {
    const fetchMachineCentres = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedWorkCentre) params.set('work_centre_id', selectedWorkCentre);
        params.set('limit', '500');
        const response = await apiFetch(`${API_BASE_URL}/api/masters/machine_centres?${params.toString()}`);
        const result = await response.json();
        if (result.success) {
          setMachineCentres(result.data);
        }
      } catch (error) {
        console.error('Error fetching machine centres:', error);
      }
    };
    if (selectedWorkCentre) fetchMachineCentres();
  }, [selectedWorkCentre]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Rework / Rejection Tracker</h1>
            <p className="text-gray-600">Track and manage rework and rejection quantities for production</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('rework_rejection')}
            className={`px-4 py-2 rounded-md text-sm font-semibold ${activeTab === 'rework_rejection' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Rework / Rejection
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('breakdown')}
            className={`px-4 py-2 rounded-md text-sm font-semibold ${activeTab === 'breakdown' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Breakdown
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 inline mr-1" />
              Production Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building className="h-4 w-4 inline mr-1" />
              Work Centre
            </label>
            {isSupervisor ? (
              <input
                type="text"
                readOnly
                value={userInfo?.work_centre_name || supervisorWorkCentreId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed"
              />
            ) : (
              <select
                value={selectedWorkCentre}
                onChange={(e) => setSelectedWorkCentre(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Work Centre</option>
                {workCentres.map((wc) => (
                  <option key={wc.id} value={wc.id}>
                    {wc.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Cpu className="h-4 w-4 inline mr-1" />
              Machine Centre
            </label>
            <select
              value={selectedMachineCentre}
              onChange={(e) => setSelectedMachineCentre(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Machines</option>
              {machineCentres.map((mc) => (
                <option key={mc.id} value={mc.name}>
                  {mc.machine_id} - {mc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {activeTab === 'rework_rejection' && (
        <ReworkRejectionEntryTab
          selectedDate={selectedDate}
          selectedWorkCentre={selectedWorkCentre}
          selectedMachineCentre={selectedMachineCentre}
          machineCentres={machineCentres}
          workCentres={workCentres}
          isSupervisor={isSupervisor}
          supervisorWorkCentreId={supervisorWorkCentreId}
          workCentreDisplayName={workCentreDisplayName}
          canEditRework={canEditRework}
          canDeleteRework={canDeleteRework}
        />
      )}

      {activeTab === 'breakdown' && (
        <StoppageEntryTab
          entryKind="breakdown"
          selectedDate={selectedDate}
          selectedWorkCentre={selectedWorkCentre}
          selectedMachineCentre={selectedMachineCentre}
          machineCentres={machineCentres}
          workCentres={workCentres}
          isSupervisor={isSupervisor}
          supervisorWorkCentreId={supervisorWorkCentreId}
          userInfo={userInfo}
          workCentreDisplayName={workCentreDisplayName}
        />
      )}
    </div>
  );
};
