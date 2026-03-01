import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ModernScanner } from './ModernScanner';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Clock, User, Factory, Cpu, Calendar } from 'lucide-react';

const API_BASE = `${window.location.protocol}//${window.location.hostname}:3001/api`;

interface ProductionStatus {
  id: number;
  prod_date: string;
  work_centre_id: number;
  machine_id: number;
  emp_id: string;
  output_pairs: number;
  target_mins: number;
  target_pairs: number;
  start_time: string;
  actual_time: number;
  button_status: number;
  operator_name?: string;
  line_name?: string;
  updated_at?: string;
}

const calculateStatus = (actualMins: number, targetMins: number, lastActivity: string | undefined, buttonStatus: number): { label: string; color: string; bgColor: string } => {
  if (buttonStatus === 3) return { label: 'Idle', color: 'text-gray-700', bgColor: 'bg-gray-400' };
  
  if (lastActivity) {
    const idleMinutes = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 60000);
    if (idleMinutes >= 5) return { label: 'Idle', color: 'text-gray-700', bgColor: 'bg-gray-400' };
  }
  
  if (targetMins === 0) return { label: 'On-track', color: 'text-white', bgColor: 'bg-green-500' };
  
  const efficiency = (actualMins / targetMins) * 100;
  if (efficiency < 80) return { label: 'Low', color: 'text-white', bgColor: 'bg-red-500' };
  return { label: 'On-track', color: 'text-white', bgColor: 'bg-green-500' };
};

export const MachineCentreProduction: React.FC = () => {
  const { machineId } = useParams();
  const navigate = useNavigate();
  
  const [scanning, setScanning] = useState(!machineId);
  const [empScanning, setEmpScanning] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [machineData, setMachineData] = useState<any>(null);
  const [planData, setPlanData] = useState<any>(null);
  const [status, setStatus] = useState<ProductionStatus | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchStatus = useCallback(async () => {
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
  }, [machineId]);

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

      const targetPairs = 12;
      const targetMins = planData.smv ? Math.round(planData.smv * targetPairs) : 60;

      const res = await axios.post(`${API_BASE}/machine-centre/start`, {
        workCentreId: machineData.workCentreId,
        machineId: machineData.machineId,
        empId: empData.emp_id,
        targetMins: targetMins,
        targetPairs: targetPairs
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

  const handleFinish = async () => {
    if (!sessionId || !status) return;
    const output = prompt(`Enter output pairs (Target: ${status.target_pairs || 12}):`);
    if (!output) return;

    const outputPairs = parseInt(output);
    if (isNaN(outputPairs) || outputPairs < 0) {
      toast.error('Invalid output value');
      return;
    }

    try {
      await axios.post(`${API_BASE}/machine-centre/finish`, {
        id: sessionId,
        outputPairs: status.output_pairs + outputPairs,
        targetPairs: status.target_pairs || 12
      });
      toast.success('Production finished');
      navigate('/mobile');
    } catch (error) {
      toast.error('Failed to finish');
    }
  };

  useEffect(() => {
    if (!sessionId || !status || status.button_status !== 1) return;

    const interval = setInterval(async () => {
      try {
        await axios.post(`${API_BASE}/machine-centre/update-time`, { id: sessionId });
        fetchStatus();
      } catch (error) {
        console.error('Timer update error:', error);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [sessionId, status, fetchStatus]);

  // Clock effect
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (machineId) {
      fetchStatus();
    }
  }, [machineId, fetchStatus]);

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
  const statusInfo = calculateStatus(status.actual_time, status.target_mins, status.updated_at, status.button_status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl shadow-xl p-4 md:p-6">
          <h1 className="text-xl md:text-2xl font-bold text-center mb-3">MACHINE CENTRE PRODUCTION</h1>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
              <Factory className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs opacity-80">Line Name</p>
                <p className="font-semibold truncate">{status.line_name || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
              <Cpu className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs opacity-80">Work Centre</p>
                <p className="font-semibold truncate">{status.work_centre_id}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
              <Cpu className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs opacity-80">Machine ID</p>
                <p className="font-semibold truncate">{status.machine_id}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
              <User className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs opacity-80">Operator</p>
                <p className="font-semibold truncate">{status.operator_name || status.emp_id}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs opacity-80">Date & Time</p>
                <p className="font-semibold text-xs">{currentTime.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Section */}
        <div className="bg-white shadow-xl p-4 md:p-6 border-x border-gray-200">
          <h2 className="text-base md:text-lg font-bold text-gray-800 mb-3 md:mb-4 uppercase tracking-wide">Production Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 md:p-6 rounded-xl border-2 border-blue-200 shadow-sm">
              <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Target Time</p>
              <p className="text-3xl md:text-5xl font-bold text-blue-900">{status.target_mins}</p>
              <p className="text-xs text-blue-600 mt-1">mins</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 md:p-6 rounded-xl border-2 border-purple-200 shadow-sm">
              <p className="text-xs font-semibold text-purple-700 uppercase mb-1">Actual Time</p>
              <p className="text-3xl md:text-5xl font-bold text-purple-900">{status.actual_time}</p>
              <p className="text-xs text-purple-600 mt-1">mins</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 md:p-6 rounded-xl border-2 border-green-200 shadow-sm">
              <p className="text-xs font-semibold text-green-700 uppercase mb-1">Target Pairs</p>
              <p className="text-3xl md:text-5xl font-bold text-green-900">{status.target_pairs || 12}</p>
              <p className="text-xs text-green-600 mt-1">pairs</p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-6 rounded-xl border-2 border-orange-200 shadow-sm">
              <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Total Output</p>
              <p className="text-3xl md:text-5xl font-bold text-orange-900">{status.output_pairs}</p>
              <p className="text-xs text-orange-600 mt-1">pairs</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 md:p-6 rounded-xl border-2 border-indigo-200 shadow-sm">
              <p className="text-xs font-semibold text-indigo-700 uppercase mb-1">Avg Efficiency</p>
              <p className="text-3xl md:text-5xl font-bold text-indigo-900">{efficiency.toFixed(1)}%</p>
              <p className="text-xs text-indigo-600 mt-1">percentage</p>
            </div>
            <div className={`p-4 md:p-6 rounded-xl border-2 shadow-sm ${statusInfo.bgColor} ${statusInfo.color}`}>
              <p className="text-xs font-semibold uppercase mb-1 opacity-90">Status</p>
              <p className="text-3xl md:text-5xl font-bold">{statusInfo.label}</p>
              <p className="text-xs mt-1 opacity-90">current</p>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="bg-white shadow-xl rounded-b-2xl p-4 md:p-6 border-x border-b border-gray-200">
          <div className="flex gap-3">
            {status.button_status === 3 ? (
              <button
                onClick={handleStart}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-green-700 hover:to-green-800 shadow-lg active:scale-95 transition-all uppercase tracking-wide"
              >
                START
              </button>
            ) : status.button_status === 1 ? (
              <>
                <button
                  onClick={handleStop}
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-yellow-600 hover:to-yellow-700 shadow-lg active:scale-95 transition-all uppercase tracking-wide"
                >
                  STOP
                </button>
                <button
                  onClick={handleFinish}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-5 md:py-6 rounded-xl font-bold text-lg md:text-xl hover:from-blue-700 hover:to-blue-800 shadow-lg active:scale-95 transition-all uppercase tracking-wide"
                >
                  FINISH
                </button>
              </>
            ) : (
              <div className="flex-1 text-center py-6 text-gray-500 font-medium">
                Production session completed
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
