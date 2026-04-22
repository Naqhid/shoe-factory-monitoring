import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch, API_BASE_URL } from '../services/api';

const API_URL = `${API_BASE_URL}/api`;

const allMenus = [
  { key: 'overview', label: 'TV Dashboard' },
  { key: 'reports', label: 'Reports' },
  { key: 'missed_actions', label: 'Missed Actions' },
  { key: 'production_routing', label: 'Production Routing' },
  { key: 'production_planning', label: 'Production Planning' },
  { key: 'line_setup_form', label: 'Line Setup Form' },
  { key: 'production_tracker', label: 'Production Tracker' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'customers', label: 'Customer' },
  { key: 'groups', label: 'Group' },
  { key: 'leather', label: 'Leather' },
  { key: 'styles', label: 'Style' },
  { key: 'colors', label: 'Color' },
  { key: 'work_centres', label: 'Work Centre' },
  { key: 'machine_centres', label: 'Machine Centre' },
  { key: 'employees', label: 'Employee' },
  { key: 'users', label: 'Users' },
  { key: 'forms_master', label: 'Forms Master' },
  { key: 'user_rights', label: 'User Rights' },
];

interface Role {
  id?: number;
  role_name: string;
  default_route: string;
  allowed_menus: string[];
}

export const RolesMasterForm: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<Role>({
    role_name: '',
    default_route: '/overview',
    allowed_menus: [],
  });
  const [fetchLoading, setFetchLoading] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setFetchLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/roles`);
      const data = await res.json();
      setRoles(data);
    } catch (error) {
      toast.error('Failed to fetch roles');
    } finally {
      setFetchLoading(false);
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
        toast.success('Role updated successfully');
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
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
      await apiFetch(`${API_URL}/roles/${id}`, { method: 'DELETE' });
      toast.success('Role deleted successfully');
      fetchRoles();
    } catch (error) {
      toast.error('Failed to delete role');
    }
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Role Management</h2>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add Role
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editingRole ? 'Edit Role' : 'Add Role'}</h3>
              <button onClick={resetForm}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Role Name</label>
                <input type="text" value={formData.role_name} onChange={(e) => setFormData({ ...formData, role_name: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Default Route</label>
                <input type="text" value={formData.default_route} onChange={(e) => setFormData({ ...formData, default_route: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Allowed Menus</label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                  {allMenus.map(menu => (
                    <label key={menu.key} className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.allowed_menus.includes(menu.key)} onChange={() => toggleMenu(menu.key)} />
                      <span className="text-sm">{menu.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  <Save className="h-4 w-4" /> Save
                </button>
                <button type="button" onClick={resetForm} className="bg-gray-300 px-4 py-2 rounded-lg hover:bg-gray-400">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {fetchLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600 text-lg">Loading data...</span>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default Route</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Menus Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {roles.map(role => (
                <tr key={role.id}>
                  <td className="px-6 py-4">{role.role_name}</td>
                  <td className="px-6 py-4">{role.default_route}</td>
                  <td className="px-6 py-4">{role.allowed_menus.length}</td>
                  <td className="px-6 py-4 flex gap-2">
                    <button onClick={() => handleEdit(role)} className="text-blue-600 hover:text-blue-800">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(role.id!)} className="text-red-600 hover:text-red-800">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
