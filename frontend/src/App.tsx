// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from './modules/auth/LoginPage'
import { TeacherLoginPage } from './modules/auth/TeacherLoginPage'
import { LobbyPage } from './modules/lobby/LobbyPage'
import { StudentRoom } from './modules/jitsi/StudentRoom'
import { TeacherDashboard } from './modules/teacher/TeacherDashboard'
import { TeacherStartPage } from './modules/teacher/TeacherStartPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Schüler */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/raum" element={<StudentRoom />} />

        {/* Lehrer */}
        <Route path="/lehrer-login" element={<TeacherLoginPage />} />
        <Route path="/lehrer-start" element={<TeacherStartPage />} />
        <Route path="/lehrer" element={<TeacherDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
