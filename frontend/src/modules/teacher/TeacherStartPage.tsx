// frontend/src/modules/teacher/TeacherStartPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface Lesson {
  id: string
  topic_number: number
  title: string
  room_code: string | null
}

interface Teacher {
  full_name: string
  lesson_id: string
}

export function TeacherStartPage() {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [teacherName, setTeacherName] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function loadData() {
      // Auth-Guard: Session prüfen
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/lehrer-login')
        return
      }

      // Lehrer-Daten laden
      const { data: teacher } = await (supabase as any)
        .from('teachers')
        .select('full_name, lesson_id')
        .eq('id', session.user.id)
        .single() as { data: Teacher | null }

      if (!teacher) {
        await supabase.auth.signOut()
        navigate('/lehrer-login')
        return
      }

      setTeacherName(teacher.full_name)

      // Lektion laden (nur wenn lesson_id vorhanden)
      if (teacher.lesson_id) {
        const { data: lessonData } = await (supabase as any)
          .from('lessons')
          .select('id, topic_number, title, room_code')
          .eq('id', teacher.lesson_id)
          .single() as { data: Lesson | null }

        setLesson(lessonData)
      }

      setLoading(false)
    }

    loadData()
  }, [navigate])

  async function generateCode() {
    if (!lesson) return
    setGenerating(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/lehrer-login'); return }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || ''
    const res = await fetch(`${backendUrl}/api/auth/room-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ lesson_id: lesson.id })
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Fehler beim Generieren')
    } else {
      const data = await res.json()
      setLesson(prev => prev ? { ...prev, room_code: data.code } : prev)
    }

    setGenerating(false)
  }

  async function startLesson() {
    if (!lesson) return

    // Lektionsdaten für TeacherDashboard in localStorage setzen
    localStorage.setItem('classroom_lesson', JSON.stringify({
      id: lesson.id,
      topic_number: lesson.topic_number,
      title: lesson.title,
      room_code: lesson.room_code,
      jitsi_room: lesson.id
    }))
    localStorage.setItem('classroom_token', '') // Lehrer braucht keinen Student-Token

    navigate('/lehrer')
  }

  async function logout() {
    await supabase.auth.signOut()
    navigate('/lehrer-login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
      <p style={{ color: '#a8a8b3' }}>Lädt...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', maxWidth: 600, margin: '0 auto 2rem' }}>
        <div>
          <h1 style={{ color: '#e94560', fontSize: '1.5rem', margin: 0 }}>Fahrschul Classroom</h1>
          <p style={{ color: '#a8a8b3', margin: '0.25rem 0 0', fontSize: '0.875rem' }}>Willkommen, {teacherName}</p>
        </div>
        <button
          onClick={logout}
          style={{
            background: 'transparent', border: '1px solid #1a4a7a',
            color: '#a8a8b3', padding: '0.5rem 1rem', borderRadius: '8px',
            cursor: 'pointer', fontSize: '0.875rem'
          }}
        >
          Abmelden
        </button>
      </div>

      {/* Lektion Card */}
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {!lesson ? (
          <div style={{ background: '#16213e', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: '#a8a8b3' }}>Keine Lektion zugewiesen. Bitte Administrator kontaktieren.</p>
          </div>
        ) : (
          <div style={{ background: '#16213e', borderRadius: 12, padding: '1.5rem', border: '1px solid #1a4a7a' }}>
            <p style={{ color: '#a8a8b3', fontSize: '0.75rem', margin: '0 0 0.25rem', textTransform: 'uppercase' }}>
              Lektion {lesson.topic_number}
            </p>
            <h2 style={{ color: '#e2e2e2', margin: '0 0 1.5rem', fontSize: '1.25rem' }}>{lesson.title}</h2>

            {/* Raum-Code Anzeige */}
            <div style={{
              background: '#0f3460', borderRadius: 10, padding: '1rem',
              textAlign: 'center', marginBottom: '1rem'
            }}>
              <p style={{ color: '#a8a8b3', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>RAUM-CODE FÜR SCHÜLER</p>
              {lesson.room_code ? (
                <p style={{ color: '#4ade80', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '0.4rem', margin: 0 }}>
                  {lesson.room_code}
                </p>
              ) : (
                <p style={{ color: '#555', fontSize: '1.25rem', margin: 0 }}>— noch kein Code —</p>
              )}
            </div>

            {error && (
              <p style={{ color: '#e94560', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
            )}

            {/* Buttons */}
            <button
              onClick={generateCode}
              disabled={generating}
              style={{
                width: '100%', padding: '0.875rem', marginBottom: '0.75rem',
                background: generating ? '#555' : '#f59e0b',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '1rem', fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer'
              }}
            >
              {generating ? 'Generiere...' : lesson.room_code ? '🔄 Neuen Code generieren' : '🔑 Code generieren'}
            </button>

            <button
              onClick={startLesson}
              disabled={!lesson.room_code}
              style={{
                width: '100%', padding: '0.875rem',
                background: lesson.room_code ? '#e94560' : '#333',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '1rem', fontWeight: 600,
                cursor: lesson.room_code ? 'pointer' : 'not-allowed',
                opacity: lesson.room_code ? 1 : 0.6
              }}
            >
              {lesson.room_code ? '▶ Unterricht starten' : 'Zuerst Code generieren'}
            </button>

            {lesson.room_code && (
              <p style={{ color: '#a8a8b3', fontSize: '0.75rem', textAlign: 'center', marginTop: '0.75rem' }}>
                Schüler öffnen: frontend.178.104.27.147.traefik.me
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
