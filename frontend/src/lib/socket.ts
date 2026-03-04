import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(token: string, lesson_id: string): Socket {
  if (socket && socket.connected) return socket

  if (socket) {
    socket.disconnect()
  }

  socket = io(import.meta.env.VITE_BACKEND_URL || '', {
    auth: { token, lesson_id }
  })

  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
