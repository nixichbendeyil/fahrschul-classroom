import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function useAuth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function login(phone_number: string, room_code: string) {
    if (!phone_number.trim() || !room_code.trim()) {
      setError('Bitte alle Felder ausfüllen')
      return
    }

    setLoading(true)
    setError('')

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || ''
      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phone_number.trim(),
          room_code: room_code.trim().toUpperCase()
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Login fehlgeschlagen')
      }

      const data = await res.json()
      localStorage.setItem('classroom_token', data.token)
      localStorage.setItem('classroom_student', JSON.stringify(data.student))
      localStorage.setItem('classroom_lesson', JSON.stringify(data.lesson))
      navigate('/lobby')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return { login, loading, error }
}
