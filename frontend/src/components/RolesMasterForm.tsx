import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Loader2, RefreshCw, RotateCcw, Bookmark, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, API_BASE_URL } from '../services/api';
import { ALL_MENU_DEFINITIONS } from '../utils/roleConfig';

const API_URL = `${API_BASE_URL}/api`;

interface Role {
  id?: number;
  role_name: string;
  default_route: string;
  allowed_menus: string[];
}

type ConfirmAction = 'save-defaults' | 'restore-defaults' | 'delete';

interface ConfirmDialogState {
  action: ConfirmAction;
  roleId?: number;
  roleName?: string;
}

const CONFIRM_COPY: Record<ConfirmAction, { title: string; message: string; confirmLabel: string; tone: 'emerald' | 'amber' | 'red' }> = {
  'save-defaults': {
    title: 'Save as factory defaults?',
    message: 'Save the current role setup as factory defaults? Restore defaults will reset all roles to this snapshot.',
    confirmLabel: 'Save defaults',
    tone: 'emerald',
  },
  'restore-defaults': {
    title: 'Restore factory defaults?',
    message: 'Restore all roles to the last saved factory defaults? Any unsaved edits will be lost.',
    confirmLabel: 'Restore defaults',
    tone: 'amber',
  },
  delete: {
    title: 'Delete role?',
    message: 'Are you sure you want to delete this role? This cannot be undone.',
    confirmLabel: 'Delete role',
    tone: 'red',
  },
};

export const RolesMasterForm: React.FC = () => {
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user_info') || 'null'); } catch { return null; }
  })();
  const isAdmin = currentUser?.role === 'Admin';

  const [roles, setRoles] = useState<Role[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<Role>({
    role_name: '',
    default_route: '/overview',
    allowed_menus: [],
  });
  const [fetchLoading, setFetchLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [saveDefaultsLoading, setSaveDefaultsLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchRoles();
  }, [debouncedSearch]);

  const fetchRoles = async () => {
    setFetchLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      const query = params.toString();
      const res = await apiFetch(`${API_URL}/roles${query ? `?${query}` : ''}`);
      const data = await res.json();
      setRoles(data);
    } catch (error) {
      toast.error('Failed to fetch roles');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSaveDefaults = async () => {
    setSaveDefaultsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/roles/save-defaults`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        toast.error(data.error || data.message || 'Failed to save defaults');
        return;
      }
      toast.success(data.message || 'Factory defaults saved');
    } catch {
      toast.error('Failed to save defaults');
    } finally {
      setSaveDefaultsLoading(false);
    }
  };

  const handleResetDefaults = async () => {
    setResetLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/roles/reset-defaults`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        toast.error(data.error || data.message || 'Failed to reset roles');
        return;
      }
      toast.success(data.message || 'Roles restored from saved defaults');
      await fetchRoles();
    } catch {
      toast.error('Failed to reset roles');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await apiFetch(`${API_URL}/roles/${editingRole.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        toast.success('Role updated — users should re-login or refresh session to apply');
      } else {
        await apiFetch(`${API_URL}/roles`, {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        toast.success('Role created successfully');
      }
      fetchRoles();
      resetForm();
    } catch (error) {
      toast.error('Failed to save role');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`${API_URL}/roles/${id}`, { method: 'DELETE' });
      toast.success('Role deleted successfully');
      fetchRoles();
    } catch (error) {
      toast.error('Failed to delete role');
    }
  };

  const runConfirmAction = async () => {
    if (!confirmDialog) return;
    const { action, roleId } = confirmDialog;
    setConfirmDialog(null);
    if (action === 'save-defaults') {
      await handleSaveDefaults();
      return;
    }
    if (action === 'restore-defaults') {
      await handleResetDefaults();
      return;
    }
    if (action === 'delete' && roleId != null) {
      await handleDelete(roleId);
    }
  };

  const confirmToneClass = (tone: 'emerald' | 'amber' | 'red') => {
    if (tone === 'emerald') return 'bg-emerald-600 hover:bg-emerald-700';
    if (tone === 'amber') return 'bg-amber-600 hover:bg-amber-700';
    return 'bg-red-600 hover:bg-red-700';
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData(role);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({ role_name: '', default_route: '/overview', allowed_menus: [] });
    setEditingRole(null);
    setShowForm(false);
  };

  const toggleMenu = (menuKey: string) => {
    setFormData(prev => ({
      ...prev,
      allowed_menus: prev.allowed_menus.includes(menuKey)
        ? prev.allowed_menus.filter(m => m !== menuKey)
        : [...prev.allowed_menus, menuKey]
    }));
  };

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-3 sm:px-4 py-3 mb-4 sm:mb-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Role Management</h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fetchRoles()}
              disabled={fetchLoading}
              title="Refresh"
              className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${fetchLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDialog({ action: 'save-defaults' })}
              disabled={saveDefaultsLoading}
              title="Save as defaults"
              className="p-2 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 disabled:opacity-50"
            >
              <Bookmark className={`h-4 w-4 ${saveDefaultsLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDialog({ action: 'restore-defaults' })}
              disabled={resetLoading}
              title="Restore defaults"
              className="p-2 rounded-lg bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 disabled:opacity-50"
            >
              <RotateCcw className={`h-4 w-4 ${resetLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Role</span>
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search roles..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400"
          />
        </div>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          Menus and API access controlled here. <strong>Save as defaults</strong> stores current setup; <strong>Restore defaults</strong> rolls back to that snapshot.
        </p>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-2xl max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg sm:text-xl font-bold">{editingRole ? 'Edit Role' : 'Add Role'}</h3>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Role Name</label>
                <input type="text" value={formData.role_name} onChange={(e) => setFormData({ ...formData, role_name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400" required />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Default Route</label>
                <input type="text" value={formData.default_route} onChange={(e) => setFormData({ ...formData, default_route: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400" required placeholder="/production_tracker" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Allowed Menus</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {ALL_MENU_DEFINITIONS.map(menu => (
                    <label key={menu.key} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50">
                      <input type="checkbox" checked={formData.allowed_menus.includes(menu.key)} onChange={() => toggleMenu(menu.key)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm">{menu.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 font-semibold">
                  <Save className="h-4 w-4" /> Save
                </button>
                <button type="button" onClick={resetForm} className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 font-semibold">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="roles-confirm-title"
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
          >
            <h3 id="roles-confirm-title" className="text-lg font-bold text-gray-900">
              {confirmDialog.action === 'delete' && confirmDialog.roleName
                ? `Delete ${confirmDialog.roleName}?`
                : CONFIRM_COPY[confirmDialog.action].title}
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              {confirmDialog.action === 'delete' && confirmDialog.roleName
                ? `Delete the "${confirmDialog.roleName}" role? This cannot be undone.`
                : CONFIRM_COPY[confirmDialog.action].message}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={saveDefaultsLoading || resetLoading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runConfirmAction}
                disabled={saveDefaultsLoading || resetLoading}
                className={`text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 ${confirmToneClass(CONFIRM_COPY[confirmDialog.action].tone)}`}
              >
                {saveDefaultsLoading || resetLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Working...
                  </span>
                ) : (
                  CONFIRM_COPY[confirmDialog.action].confirmLabel
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm ring-1 ring-black/[0.03] overflow-hidden">
        {fetchLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600 text-lg">Loading data...</span>
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {debouncedSearch ? 'No matching roles found' : 'No roles found'}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-violet-600 to-purple-600">
                    <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">Role Name</th>
                    <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">Default Route</th>
                    <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">Menus</th>
                    <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-white uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {roles.map((role, idx) => (
                    <tr key={role.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-purple-50/40'} ${!isAdmin && role.role_name === 'Admin' ? 'opacity-60' : ''}`}>
                      <td className="px-4 sm:px-6 py-3.5 text-sm font-semibold text-gray-900">{role.role_name}</td>
                      <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-600 font-mono">{role.default_route}</td>
                      <td className="px-4 sm:px-6 py-3.5">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                          {role.allowed_menus.length}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(role)}
                            disabled={!isAdmin && role.role_name === 'Admin'}
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-100 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            title={!isAdmin && role.role_name === 'Admin' ? 'Only Admin can edit this role' : 'Edit'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDialog({ action: 'delete', roleId: role.id, roleName: role.role_name })}
                            disabled={!isAdmin && role.role_name === 'Admin'}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-100 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            title={!isAdmin && role.role_name === 'Admin' ? 'Only Admin can delete this role' : 'Delete'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="sm:hidden divide-y divide-gray-200">
              {roles.map((role) => (
                <div key={role.id} className={`p-3 space-y-2 ${!isAdmin && role.role_name === 'Admin' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900">{role.role_name}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{role.default_route}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEdit(role)}
                        disabled={!isAdmin && role.role_name === 'Admin'}
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDialog({ action: 'delete', roleId: role.id, roleName: role.role_name })}
                        disabled={!isAdmin && role.role_name === 'Admin'}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                      {role.allowed_menus.length} menus
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
