import { useState, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'

export function useAttendance(socket: Socket | null) {
  const [active, setActive] = useState(false)
  const [timeLeft, setTimeLeft] = useState(120)
  const [confirmed, setConfirmed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!socket) return

    socket.on('attendance:start', ({ duration }: { duration: number }) => {
      setActive(true)
      setTimeLeft(duration)
      setConfirmed(false)

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            setActive(false)
            return 0
          }
          return t - 1
        })
      }, 1000)
    })

    socket.on('attendance:end', () => {
      if (timerRef.current) clearInterval(timerRef.current)
      setActive(false)
    })

    return () => {
      socket.off('attendance:start')
      socket.off('attendance:end')
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [socket])

  function confirm() {
    if (!confirmed) {
      socket?.emit('attendance:confirm')
      setConfirmed(true)
    }
  }

  return { active, timeLeft, confirmed, confirm }
}
