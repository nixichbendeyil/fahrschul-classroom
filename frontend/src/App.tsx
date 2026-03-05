// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './modules/auth/LoginPage'
import { StaffLoginPage } from './modules/auth/StaffLoginPage'
import { LobbyPage } from './modules/lobby/LobbyPage'
import { StudentRoom } from './modules/jitsi/StudentRoom'
import { TeacherDashboard } from './modules/teacher/TeacherDashboard'
import { TeacherStartPage } from './modules/teacher/TeacherStartPage'
import { AdminDashboard } from './modules/admin/AdminDashboard'
import { AdminLehrer } from './modules/admin/AdminLehrer'
import { AdminSchueler } from './modules/admin/AdminSchueler'
import { AdminLektionen } from './modules/admin/AdminLektionen'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Schüler */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/raum" element={<StudentRoom />} />

        {/* Staff Login (einheitlich) */}
        <Route path="/login" element={<StaffLoginPage />} />
        <Route path="/lehrer-login" element={<Navigate to="/login" replace />} />

        {/* Lehrer */}
        <Route path="/lehrer-start" element={<TeacherStartPage />} />
        <Route path="/lehrer" element={<TeacherDashboard />} />

        {/* Admin */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/lehrer" element={<AdminLehrer />} />
        <Route path="/admin/schueler" element={<AdminSchueler />} />
        <Route path="/admin/lektionen" element={<AdminLektionen />} />
      </Routes>
    </BrowserRouter>
  )
}
