import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, options: object) => JitsiAPI
  }
}

interface JitsiAPI {
  executeCommand: (command: string, ...args: unknown[]) => void
  addListener: (event: string, callback: (e: unknown) => void) => void
  dispose: () => void
}

interface JitsiOptions {
  room: string
  displayName: string
  isTeacher: boolean
  onParticipantJoined?: (data: { id: string; displayName: string }) => void
  onHandRaised?: (data: { id: string; handRaised: boolean }) => void
}

export function useJitsi(containerId: string, options: JitsiOptions) {
  const apiRef = useRef<JitsiAPI | null>(null)
  const domain = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si'

  useEffect(() => {
    // Jitsi External API Script laden
    const scriptId = 'jitsi-external-api'
    let script = document.getElementById(scriptId) as HTMLScriptElement | null

    const initJitsi = () => {
      if (!window.JitsiMeetExternalAPI) return

      const container = document.getElementById(containerId)
      if (!container) return

      apiRef.current = new window.JitsiMeetExternalAPI(domain, {
        roomName: options.room,
        parentNode: container,
        userInfo: { displayName: options.displayName },
        configOverwrite: {
          startWithAudioMuted: !options.isTeacher,
          startWithVideoMuted: true,
          toolbarButtons: [],
          disableDeepLinking: true,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_POWERED_BY: false,
          FILM_STRIP_MAX_HEIGHT: 0,
        }
      })

      if (options.onParticipantJoined) {
        apiRef.current.addListener('participantJoined', options.onParticipantJoined as (e: unknown) => void)
      }
      if (options.onHandRaised) {
        apiRef.current.addListener('raiseHandUpdated', options.onHandRaised as (e: unknown) => void)
      }
    }

    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = `https://${domain}/external_api.js`
      script.onload = initJitsi
      document.head.appendChild(script)
    } else if (window.JitsiMeetExternalAPI) {
      initJitsi()
    } else {
      script.addEventListener('load', initJitsi)
    }

    return () => {
      apiRef.current?.dispose()
      apiRef.current = null
    }
  }, [containerId, options.room, domain])

  const muteAll = () => apiRef.current?.executeCommand('muteEveryone', 'audio')
  const shareScreen = () => apiRef.current?.executeCommand('toggleShareScreen')
  const setDisplayName = (name: string) => apiRef.current?.executeCommand('displayName', name)

  return { muteAll, shareScreen, setDisplayName }
}
