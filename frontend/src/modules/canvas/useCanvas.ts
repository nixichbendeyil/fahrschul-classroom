import { useRef, useEffect, useCallback } from 'react'
import { Socket } from 'socket.io-client'

interface StrokeData {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width: number
}

export function useCanvas(socket: Socket | null, isTeacher: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const color = useRef('#ff0000')
  const strokeWidth = useRef(3)

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d'), [])

  const drawStroke = useCallback((data: StrokeData) => {
    const ctx = getCtx()
    if (!ctx) return
    ctx.strokeStyle = data.color
    ctx.lineWidth = data.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(data.x1, data.y1)
    ctx.lineTo(data.x2, data.y2)
    ctx.stroke()
  }, [getCtx])

  // Socket-Events empfangen
  useEffect(() => {
    if (!socket) return
    socket.on('draw:stroke', drawStroke)
    socket.on('draw:clear', () => {
      const ctx = getCtx()
      const canvas = canvasRef.current
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
    })
    return () => {
      socket.off('draw:stroke', drawStroke)
      socket.off('draw:clear')
    }
  }, [socket, drawStroke, getCtx])

  // Canvas-Größe an Container anpassen
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = width
      canvas.height = height
    })
    resizeObserver.observe(canvas)
    return () => resizeObserver.disconnect()
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isTeacher) return
    drawing.current = true
    const rect = canvasRef.current!.getBoundingClientRect()
    lastPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    canvasRef.current?.setPointerCapture(e.pointerId)
  }, [isTeacher])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawing.current || !isTeacher || !lastPos.current || !socket) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const x2 = e.clientX - rect.left
    const y2 = e.clientY - rect.top
    const { x: x1, y: y1 } = lastPos.current
    const data: StrokeData = { x1, y1, x2, y2, color: color.current, width: strokeWidth.current }
    drawStroke(data)
    socket.emit('draw:stroke', data)
    lastPos.current = { x: x2, y: y2 }
  }, [isTeacher, socket, drawStroke])

  const handlePointerUp = useCallback(() => {
    drawing.current = false
    lastPos.current = null
  }, [])

  const clearCanvas = useCallback(() => {
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
    socket?.emit('draw:clear')
  }, [socket, getCtx])

  return {
    canvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    clearCanvas,
    color,
    strokeWidth
  }
}
