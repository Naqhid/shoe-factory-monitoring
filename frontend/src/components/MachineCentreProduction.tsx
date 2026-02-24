import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ModernScanner } from './ModernScanner';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = `${window.location.protocol}//${window.location.hostname}:3001/api`;

export const MachineCentreProduction: React.FC = () => {
  const { machineId } = useParams();
  const navigate = useNavigate();
  
  const [scanning, setScanning] = useState(!machineId);
  const [empScanning, setEmpScanning] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [machineData, setMachineData] = useState<any>(null);
  const [planData, setPlanData] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch machine status
  const fetchStatus = async () => {
    if (!machineId) return;
    try {
      const res = await axios.get(`${API_BASE}/machine-centre/status/${machineId}`);
      if (res.data.success && res.data.data) {
        setStatus(res.data.data);
        setSessionId(res.data.data.id);
      }
    } catch (error) {
      console.error('Fetch status error:', error);
    }
  };

  // Fetch production plan
  const fetchPlan = async (workCentreId: number, machId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/machine-centre/plan/${workCentreId}/${machId}`);
      if (res.data.success) {
        setPlanData(res.data.data);
      }
    } catch (error) {
      console.error('Fetch plan error:', error);
    }
  };

  // Handle machine QR scan
  const handleMachineScan = async (text: string) => {
    try {
      const data = JSON.parse(text);
      if (data.workCentreId && data.machineId) {
        setMachineData(data);
        await fetchPlan(data.workCentreId, data.machineId);
        setScanning(false);
        setEmpScanning(true);
      }
    } catch (error) {
      toast.error('Invalid machine QR code');
    }
  };

  // Handle employee QR scan
  const handleEmpScan = async (text: string) => {
    try {
      const empData = JSON.parse(text);
      if (!empData.emp_id) {
        toast.error('Invalid employee QR code');
        return;
      }

      if (!planData) {
        toast.error('No production plan found for today');
        return;
      }

      // Calculate target mins for 12 pairs
      const targetMins = planData.smv ? (planData.smv * 12) : 60;

      const res = await axios.post(`${API_BASE}/machine-centre/start`, {
        workCentreId: machineData.workCentreId,
        machineId: machineData.machineId,
        empId: empData.emp_id,
        targetMins: targetMins,
        targetPairs: 12
      });

      if (res.data.success) {
        setSessionId(res.data.id);
        setEmpScanning(false);
        navigate(`/mobile/machine-centre/${machineData.machineId}`);
        fetchStatus();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start production');
    }
  };

  // Start production
  const handleStart = async () => {
    if (!sessionId) return;
    try {
      await axios.post(`${API_BASE}/machine-centre/resume`, { id: sessionId });
      toast.success('Production resumed');
      fetchStatus();
    } catch (error) {
      toast.error('Failed to resume');
    }
  };

  // Stop production
  const handleStop = async () => {
    if (!sessionId) return;
    try {
      await axios.post(`${API_BASE}/machine-centre/stop`, { id: sessionId });
      toast.success('Production stopped');
      fetchStatus();
    } catch (error) {
      toast.error('Failed to stop');
    }
  };

  // Finish production
  const handleFinish = async () => {
    if (!sessionId) return;
    const output = prompt('Enter output pairs:');
    if (!output) return;

    try {
      await axios.post(`${API_BASE}/machine-centre/finish`, {
        id: sessionId,
        outputPairs: parseInt(output)
      });
      toast.success('Production finished');
      navigate('/mobile');
    } catch (error) {
      toast.error('Failed to finish');
    }
  };

  // Timer effect - update every minute
  useEffect(() => {
    if (!sessionId || !status || status.button_status !== 1) return;

    const interval = setInterval(async () => {
      try {
        await axios.post(`${API_BASE}/machine-centre/update-time`, { id: sessionId });
        fetchStatus();
      } catch (error) {
        console.error('Timer update error:', error);
      }
    }, 60000); // Every 1 minute

    return () => clearInterval(interval);
  }, [sessionId, status]);

  // Clock effect
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial fetch
  useEffect(() => {
    if (machineId) {
      fetchStatus();
    }
  }, [machineId]);

  if (scanning) {
    return (
      <div className="h-screen flex flex-col bg-gray-900">
        <div className="p-4 bg-blue-600 text-white text-center">
          <h2 className="text-xl font-bold">Scan Machine QR Code</h2>
        </div>
        <div className="flex-1">
          <ModernScanner
            onScan={handleMachineScan}
            onError={(err) => toast.error(err.message)}
            facingMode="environment"
          />
        </div>
      </div>
    );
  }

  if (empScanning) {
    return (
      <div className="h-screen flex flex-col bg-gray-900">
        <div className="p-4 bg-green-600 text-white text-center">
          <h2 className="text-xl font-bold">Scan Employee QR Code</h2>
        </div>
        <div className="flex-1">
          <ModernScanner
            onScan={handleEmpScan}
            onError={(err) => toast.error(err.message)}
            facingMode="environment"
          />
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const efficiency = status.target_mins > 0 ? (status.actual_time / status.target_mins * 100) : 0;
  const statusColor = status.button_status === 3 ? 'bg-yellow-500' : 
                      efficiency < 80 ? 'bg-red-500' : 'bg-green-500';

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6">
          <h1 className="text-2xl font-bold text-center">MACHINE CENTRE PRODUCTION</h1>
          <p className="text-center text-sm mt-2">{currentTime.toLocaleString()}</p>
        </div>

        {/* Info Section */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Line</p>
              <p className="font-semibold">{status.line_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Operator</p>
              <p className="font-semibold">{status.operator_name || status.emp_id}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Machine ID</p>
              <p className="font-semibold">{status.machine_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date</p>
              <p className="font-semibold">{new Date(status.prod_date).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Target Time</p>
              <p className="text-2xl font-bold text-blue-600">{status.target_mins}m</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Actual Time</p>
              <p className="text-2xl font-bold text-purple-600">{status.actual_time}m</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Output</p>
              <p className="text-2xl font-bold text-green-600">{status.output_pairs}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Efficiency</p>
              <p className="text-2xl font-bold text-orange-600">{efficiency.toFixed(1)}%</p>
            </div>
          </div>

          {/* Status */}
          <div className="mt-6">
            <div className={`${statusColor} text-white p-4 rounded-lg text-center`}>
              <p className="text-lg font-bold">{status.status_label}</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {status.button_status === 3 && (
              <button
                onClick={handleStart}
                className="col-span-3 bg-green-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-green-700"
              >
                START
              </button>
            )}
            {status.button_status === 1 && (
              <>
                <button
                  onClick={handleStop}
                  className="bg-yellow-600 text-white py-4 rounded-lg font-bold hover:bg-yellow-700"
                >
                  STOP
                </button>
                <button
                  onClick={handleFinish}
                  className="col-span-2 bg-blue-600 text-white py-4 rounded-lg font-bold hover:bg-blue-700"
                >
                  FINISH
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
