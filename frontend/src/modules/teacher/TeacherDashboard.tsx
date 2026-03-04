import { useState } from 'react'
import { useJitsi } from '../jitsi/useJitsi'
import { DrawingCanvas } from '../canvas/DrawingCanvas'
import { StudentList } from './StudentList'
import { TeacherControls } from './TeacherControls'
import { getSocket } from '../../lib/socket'

export function TeacherDashboard() {
  const [canvasActive, setCanvasActive] = useState(false)

  const token = localStorage.getItem('classroom_token') || ''
  const lesson = JSON.parse(localStorage.getItem('classroom_lesson') || '{}')
  const socket = token && lesson.id ? getSocket(token, lesson.id) : null

  const { muteAll, shareScreen } = useJitsi('jitsi-teacher-container', {
    room: lesson.jitsi_room || lesson.id || 'teacher-room',
    displayName: 'Lehrer',
    isTeacher: true
  })

  function startCheck() {
    socket?.emit('attendance:start')
  }

  function grantMic(studentId: string) {
    socket?.emit('mic:grant', { target_student_id: studentId })
  }

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      background: '#1a1a2e',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Hauptbereich: Jitsi + Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div id="jitsi-teacher-container" style={{ width: '100%', height: '100%' }} />
        <DrawingCanvas socket={socket} isTeacher={true} active={canvasActive} />
      </div>

      {/* Sidebar */}
      <div style={{
        width: 280,
        background: '#16213e',
        overflowY: 'auto',
        borderLeft: '1px solid #1a4a7a',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <TeacherControls
          roomCode={lesson.room_code || ''}
          canvasActive={canvasActive}
          onStartCheck={startCheck}
          onMuteAll={muteAll}
          onShareScreen={shareScreen}
          onToggleCanvas={() => setCanvasActive(a => !a)}
        />
        <StudentList socket={socket} onGrantMic={grantMic} />
      </div>
    </div>
  )
}
