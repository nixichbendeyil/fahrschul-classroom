import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from './modules/auth/LoginPage'
import { LobbyPage } from './modules/lobby/LobbyPage'
import { StudentRoom } from './modules/jitsi/StudentRoom'
import { TeacherDashboard } from './modules/teacher/TeacherDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/raum" element={<StudentRoom />} />
        <Route path="/lehrer" element={<TeacherDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
