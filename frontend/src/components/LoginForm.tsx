import React, { useState } from 'react';
import { LogIn, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { getDefaultRoute, type UserRole } from '../utils/roleConfig';

export const LoginForm: React.FC = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !password) {
      toast.error('Please enter login and password');
      return;
    }
    setLoading(true);
    try {
      const data = await apiService.login({ login, password });

      if (data.success) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('app_authenticated', '1');
          sessionStorage.setItem('user_info', JSON.stringify(data.data));
        }
        const user = data.data;
        toast.success(`Welcome, ${user.name}`);

        const userRole = (user.role || 'Admin') as UserRole;
        const defaultRoute = getDefaultRoute(userRole);
        navigate(defaultRoute);
      } else {
        toast.error(data.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Network error during login';
      
      if (error.message?.includes('timed out')) {
        errorMessage = 'Server is not responding. Please check if backend is running on port 3001.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Activity className="h-12 w-12 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ProdPulse</h1>
              <p className="text-sm text-gray-600">Smart Production Tracking System</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Login <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="User login"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base flex items-center justify-center gap-2 transition-colors"
            >
              <LogIn className="h-5 w-5" />
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
