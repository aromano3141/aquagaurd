import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import NetworkOverview from './pages/NetworkOverview'
import DetectionResults from './pages/DetectionResults'
import SensorExplorer from './pages/SensorExplorer'
import Simulation from './pages/Simulation'
import CitySandbox from './pages/CitySandbox'
import Savings from './pages/Savings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<NetworkOverview />} />
          <Route path="/results" element={<DetectionResults />} />
          <Route path="/sensors" element={<SensorExplorer />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/sandbox" element={<CitySandbox />} />
          <Route path="/savings" element={<Savings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
