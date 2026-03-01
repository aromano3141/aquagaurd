import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getNetwork, getGroundTruth, getPipelineResults } from './api/client'
import Layout from './components/Layout'
import NetworkOverview from './pages/NetworkOverview'
import Simulation from './pages/Simulation'
import CitySandbox from './pages/CitySandbox'
import Savings from './pages/Savings'

// Prefetch critical data on app mount (runs regardless of active page)
function Prefetcher() {
  useQuery({ queryKey: ['network'], queryFn: getNetwork })
  useQuery({ queryKey: ['groundTruth'], queryFn: getGroundTruth })
  useQuery({ queryKey: ['pipeline'], queryFn: getPipelineResults })
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <Prefetcher />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<NetworkOverview />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/sandbox" element={<CitySandbox />} />
          <Route path="/savings" element={<Savings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
