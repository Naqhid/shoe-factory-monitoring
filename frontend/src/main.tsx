import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import { MachineCentreProduction } from './components/MachineCentreProduction.tsx'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './index.css'

function PWAUpdater() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-4">
      <span className="text-sm font-medium">New version available!</span>
      <button onClick={() => updateServiceWorker(true)} className="bg-white text-blue-600 text-sm font-semibold px-3 py-1 rounded-lg hover:bg-blue-50">
        Update
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PWAUpdater />
      <Routes>
        <Route path="/mobile/machine-centre" element={<MachineCentreProduction />} />
        <Route path="/mobile/machine-centre/:machineId" element={<MachineCentreProduction />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)