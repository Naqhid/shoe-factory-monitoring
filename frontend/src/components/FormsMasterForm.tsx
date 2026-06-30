import React from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { Plus, Edit, Trash2, X, Download, Loader2, MonitorUp, Copy, Square, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { API_BASE_URL as API_BASE, apiFetch } from '../services/api';
import { Pagination } from './Pagination';
import { usePagination } from '../hooks/usePagination';

interface FormRecord {
  id: number;
  code: string;
  name: string;
  created_at?: string;
}

export const FormsMasterForm: React.FC = () => {
  const [records, setRecords] = React.useState<FormRecord[]>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState<FormRecord | null>(null);
  const [formData, setFormData] = React.useState({ code: '', name: '' });
  const [loading, setLoading] = React.useState(false);
  const [fetchLoading, setFetchLoading] = React.useState(false);
  const [nextCode, setNextCode] = React.useState('FRM001');
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [pagination, setPagination] = React.useState({ total: 0, totalPages: 1 });
  const [isBroadcasting, setIsBroadcasting] = React.useState(false);
  const [broadcastId, setBroadcastId] = React.useState('forms-master-live');
  const [broadcastMode, setBroadcastMode] = React.useState<'screen' | 'camera' | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const intervalRef = React.useRef<number | null>(null);


  const generateNextCode = (existingRecords: FormRecord[]) => {
    if (existingRecords.length === 0) return 'FRM001';
    const codes = existingRecords
      .map(r => r.code)
      .filter(c => /^FRM\d+$/.test(c))
      .map(c => parseInt(c.replace('FRM', ''), 10));
    const maxNum = codes.length > 0 ? Math.max(...codes) : 0;
    return `FRM${String(maxNum + 1).padStart(3, '0')}`;
  };

  const fetchRecords = async () => {
    setFetchLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/api/masters/forms_master?page=${currentPage}&limit=${itemsPerPage}`);
      const result = await response.json();
      if (result.success) {
        setRecords(result.data);
        if (result.pagination) {
          setPagination({ total: result.pagination.total, totalPages: result.pagination.totalPages });
        }
        const allResponse = await apiFetch(`${API_BASE}/api/masters/forms_master`);
        const allResult = await allResponse.json();
        if (allResult.success) {
          setNextCode(generateNextCode(allResult.data));
        }
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
    } finally {
      setFetchLoading(false);
    }
  };

  React.useEffect(() => {
    fetchRecords();
  }, []);

  React.useEffect(() => {
    fetchRecords();
  }, [currentPage, itemsPerPage]);

  const resetForm = () => {
    setFormData({ code: '', name: '' });
    setEditingRecord(null);
    setShowForm(false);
  };

  const handleAddNew = () => {
    setFormData({ code: nextCode, name: '' });
    setEditingRecord(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Form name is required');
      return;
    }

    setLoading(true);
    try {
      const url = editingRecord
        ? `${API_BASE}/api/masters/forms_master/${editingRecord.id}`
        : `${API_BASE}/api/masters/forms_master`;

      const method = editingRecord ? 'PUT' : 'POST';
      const payload = editingRecord
        ? { name: formData.name }
        : { code: formData.code, name: formData.name };

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(editingRecord ? 'Form updated' : 'Form created');
        resetForm();
        fetchRecords();
      } else {
        toast.error(result.error || 'Operation failed');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: FormRecord) => {
    setEditingRecord(record);
    setFormData({ code: record.code, name: record.name });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteId(null);
    try {
      const response = await apiFetch(`${API_BASE}/api/masters/forms_master/${deleteId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Form deleted');
        fetchRecords();
      } else {
        toast.error(result.error || 'Delete failed');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleExportToExcel = () => {
    if (records.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = records.map(record => ({
      'Form Code': record.code,
      'Form Name': record.name,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Forms Master');

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Forms_Master_${timestamp}.xlsx`;

    XLSX.writeFile(wb, filename);
    toast.success('Exported successfully');
  };

  const stopBroadcast = async () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    setIsBroadcasting(false);
    setBroadcastMode(null);
    try {
      await apiFetch(`${API_BASE}/api/tab-broadcast/${encodeURIComponent(broadcastId)}/stop`, { method: 'POST' });
    } catch (error) {
      // Ignore stop endpoint errors; local stop should always succeed.
    }
  };

  const startBroadcast = async () => {
    const enteredId = window.prompt('Enter broadcast ID (use same ID on viewer device):', broadcastId);
    if (enteredId === null) return;
    const normalizedId = enteredId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!normalizedId) {
      toast.error('Please enter a valid broadcast ID');
      return;
    }

    if (isBroadcasting) {
      await stopBroadcast();
    }

    setBroadcastId(normalizedId);

    try {
      let stream: MediaStream;
      let mode: 'screen' | 'camera' = 'screen';

      if (navigator.mediaDevices?.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 8 },
          audio: false,
        });
      } else if (navigator.mediaDevices?.getUserMedia) {
        try {
          // Force front camera when device supports strict facing mode.
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { exact: 'user' },
              frameRate: { ideal: 8, max: 12 },
            },
            audio: false,
          });
        } catch (strictFacingError) {
          // Some browsers reject exact constraint; retry with soft preference.
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              frameRate: { ideal: 8, max: 12 },
            },
            audio: false,
          });
        }
        mode = 'camera';
        toast('Screen share not supported here. Broadcasting camera feed instead.');
      } else {
        toast.error('This browser cannot capture screen or camera for broadcast');
        return;
      }

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      streamRef.current = stream;
      videoRef.current = video;

      const captureAndUpload = async () => {
        if (!video.videoWidth || !video.videoHeight) return;

        const maxWidth = 1024;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const width = Math.floor(video.videoWidth * scale);
        const height = Math.floor(video.videoHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, width, height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.6);

        await apiFetch(`${API_BASE}/api/tab-broadcast/${encodeURIComponent(normalizedId)}/frame`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageDataUrl,
            sourcePage: window.location.pathname,
          }),
        });
      };

      await captureAndUpload();
      intervalRef.current = window.setInterval(() => {
        captureAndUpload().catch(() => {
          // Keep trying even if one frame upload fails.
        });
      }, 2000);

      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          stopBroadcast().catch(() => {});
        };
      });

      setIsBroadcasting(true);
      setBroadcastMode(mode);
      toast.success(mode === 'screen' ? 'Screen broadcast started' : 'Camera broadcast started');
    } catch (error) {
      toast.error('Capture permission denied or broadcast failed');
    }
  };

  const copyViewerLink = async () => {
    const viewerUrl = `${API_BASE}/api/tab-broadcast/${encodeURIComponent(broadcastId)}/view`;
    try {
      await navigator.clipboard.writeText(viewerUrl);
      toast.success('Viewer link copied');
    } catch (error) {
      toast.error(`Copy failed. Open this URL manually: ${viewerUrl}`);
    }
  };

  React.useEffect(() => {
    return () => {
      stopBroadcast().catch(() => {});
    };
  }, []);

  return (
    <div className="p-6">
      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Form"
        message="Are you sure you want to delete this form? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        confirmText="Delete"
      />
      
      <header className="sticky top-0 bg-white shadow-sm border-b border-gray-200 px-4 py-3 z-40 mb-6 pl-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Forms Master</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => fetchRecords()}
              disabled={fetchLoading}
              title="Reload from server"
              className="bg-slate-100 text-slate-700 border border-slate-200 px-3 sm:px-4 py-2 rounded-md hover:bg-slate-200 flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${fetchLoading ? 'animate-spin' : ''}`} />
              <span className="sm:inline hidden">Refresh</span>
            </button>
            <button
              onClick={copyViewerLink}
              className="bg-gray-700 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-gray-800 flex items-center justify-center gap-2 text-sm sm:text-base"
              title={`Viewer ID: ${broadcastId}`}
            >
              <Copy className="h-4 w-4" />
              <span className="sm:inline hidden">Copy Viewer Link</span>
              <span className="sm:hidden">Copy Link</span>
            </button>
            <button
              onClick={isBroadcasting ? stopBroadcast : startBroadcast}
              className={`${isBroadcasting ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'} text-white px-3 sm:px-4 py-2 rounded-md flex items-center justify-center gap-2 text-sm sm:text-base`}
              title={!isBroadcasting ? 'Starts screen share where supported, otherwise camera feed fallback' : undefined}
            >
              {isBroadcasting ? <Square className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
              <span className="sm:inline hidden">
                {isBroadcasting
                  ? `Stop ${broadcastMode === 'camera' ? 'Camera' : 'Broadcast'}`
                  : 'Start Broadcast'}
              </span>
              <span className="sm:hidden">{isBroadcasting ? 'Stop' : 'Broadcast'}</span>
            </button>
            <button
              onClick={handleExportToExcel}
              className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Download className="h-4 w-4" />
              <span className="sm:inline hidden">Export to Excel</span>
              <span className="sm:hidden">Export</span>
            </button>
            <button
              onClick={handleAddNew}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Plus className="h-4 w-4" />
              <span className="sm:inline hidden">Add New</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </header>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {editingRecord ? 'Edit' : 'Add'} Form
              </h2>
              <button onClick={resetForm}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Form Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  readOnly
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-generated</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Form Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter form name"
                  required
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {fetchLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600 text-lg">Loading data...</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Form Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Form Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {record.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(record)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {records.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No forms found
            </div>
          )}
        </div>
        {pagination.total > 10 && (
        <Pagination
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(newLimit) => {
            setItemsPerPage(newLimit);
            setCurrentPage(1);
          }}
        />
        )}
          </>
        )}
      </div>
    </div>
  );
};

