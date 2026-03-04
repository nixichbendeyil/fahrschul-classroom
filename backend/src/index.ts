import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

const app = express()
const httpServer = createServer(app)

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
})

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(express.json())

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// Routes (werden später hinzugefügt)
import authRouter from './modules/auth/auth.routes'
import roomsRouter from './modules/rooms/rooms.routes'

app.use('/api/auth', authRouter)
app.use('/api/rooms', roomsRouter)

// Socket.io
import { registerSocketHandlers } from './socket/index'
registerSocketHandlers(io)

const PORT = process.env.PORT || 3002
httpServer.listen(PORT, () => {
  console.log(`Backend läuft auf Port ${PORT}`)
})
