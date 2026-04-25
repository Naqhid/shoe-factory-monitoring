import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

const MachineCentreProduction = lazy(() => import('./components/MachineCentreProduction.tsx').then(m => ({ default: m.MachineCentreProduction })));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <Routes>
          <Route path="/mobile/machine-centre" element={<MachineCentreProduction />} />
          <Route path="/mobile/machine-centre/:machineId" element={<MachineCentreProduction />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)