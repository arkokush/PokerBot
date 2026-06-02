import { HashRouter, Routes, Route } from 'react-router-dom'
import { Lobby } from './pages/Lobby'
import { Setup } from './pages/Setup'
import { Play } from './pages/Play'
import { Review } from './pages/Review'
import { WhatIsCFR } from './pages/WhatIsCFR'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/play/:sessionId" element={<Play />} />
        <Route path="/review/:sessionId" element={<Review />} />
        <Route path="/what-is-cfr" element={<WhatIsCFR />} />
      </Routes>
    </HashRouter>
  )
}
