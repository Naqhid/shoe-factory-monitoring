import React, { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

// Lazy load components
const Header = lazy(() => import('./components/Header').then(m => ({ default: m.Header })));
const StatsPanel = lazy(() => import('./components/StatsPanel').then(m => ({ default: m.StatsPanel })));
const MachineCard = lazy(() => import('./components/MachineCard').then(m => ({ default: m.MachineCard })));
const EfficiencyChart = lazy(() => import('./components/EfficiencyChart').then(m => ({ default: m.EfficiencyChart })));
const MachineDetailModal = lazy(() => import('./components/MachineDetailModal').then(m => ({ default: m.MachineDetailModal })));
const Navigation = lazy(() => import('./components/Navigation').then(m => ({ default: m.Navigation })));
const MasterForm = lazy(() => import('./components/MasterForm').then(m => ({ default: m.MasterForm })));
const ProductionPlanningForm = lazy(() => import('./components/ProductionPlanningForm').then(m => ({ default: m.ProductionPlanningForm })));
const Reports = lazy(() => import('./components/Reports').then(m => ({ default: m.Reports })));
const ProductionRoutingForm = lazy(() => import('./components/ProductionRoutingForm').then(m => ({ default: m.ProductionRoutingForm })));
const MobileLineSetupForm = lazy(() => import('./components/MobileLineSetupForm').then(m => ({ default: m.MobileLineSetupForm })));
const MobileLiveDashboard = lazy(() => import('./components/MobileLiveDashboard').then(m => ({ default: m.MobileLiveDashboard })));
const MobileLineSelector = lazy(() => import('./components/MobileLineSelector').then(m => ({ default: m.MobileLineSelector })));
const MobileLineProduction = lazy(() => import('./components/MobileLineProduction').then(m => ({ default: m.MobileLineProduction })));
const MobileProduction = lazy(() => import('./components/MobileProduction').then(m => ({ default: m.MobileProduction })));
const MobileRemoteSetup = lazy(() => import('./components/MobileRemoteSetup').then(m => ({ default: m.MobileRemoteSetup })));
const LoginForm = lazy(() => import('./components/LoginForm').then(m => ({ default: m.LoginForm })));
const TrackerApp = lazy(() => import('./components/TrackerApp').then(m => ({ default: m.TrackerApp })));
const ProductionTracker = lazy(() => import('./components/ProductionTracker').then(m => ({ default: m.ProductionTracker })));
const UsersMasterForm = lazy(() => import('./components/UsersMasterForm').then(m => ({ default: m.UsersMasterForm })));
const FormsMasterForm = lazy(() => import('./components/FormsMasterForm').then(m => ({ default: m.FormsMasterForm })));
const UserRightsForm = lazy(() => import('./components/UserRightsForm').then(m => ({ default: m.UserRightsForm })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: 500,
      staleTime: 30000, // 30 seconds
      cacheTime: 300000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
);

function AppWithProvider() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<LoadingFallback />}>
        {/* Your existing App component logic here */}
      </Suspense>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default AppWithProvider;
