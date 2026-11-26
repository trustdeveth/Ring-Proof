import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './styles.css'

const Landing = lazy(() => import('./landing/Landing'))
const AppRoot = lazy(() => import('./app/AppRoot'))
const Lab = lazy(() => import('./three/Lab'))
const Docs = lazy(() => import('./docs/Docs'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/app/*" element={<AppRoot />} />
          <Route path="/docs" element={<Docs />} />
          {import.meta.env.DEV && <Route path="/__lab" element={<Lab />} />}
          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
