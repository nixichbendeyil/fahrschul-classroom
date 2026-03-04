import { useEffect } from 'react'
import { useJitsi } from './useJitsi'
import { AttendanceCheck } from '../attendance/AttendanceCheck'
import { getSocket } from '../../lib/socket'

export function StudentRoom() {
  const token = localStorage.getItem('classroom_token') || ''
  const lesson = JSON.parse(localStorage.getItem('classroom_lesson') || '{}')
  const student = JSON.parse(localStorage.getItem('classroom_student') || '{}')

  const socket = token && lesson.id ? getSocket(token, lesson.id) : null

  const { setDisplayName } = useJitsi('jitsi-container', {
    room: lesson.jitsi_room || lesson.id || 'test-room',
    displayName: student.full_name || 'Schüler',
    isTeacher: false
  })

  useEffect(() => {
    if (student.full_name) {
      setTimeout(() => setDisplayName(student.full_name), 2000)
    }
  }, [student.full_name])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', position: 'relative' }}>
      <div id="jitsi-container" style={{ width: '100%', height: '100%' }} />
      <AttendanceCheck socket={socket} />
    </div>
  )
}
