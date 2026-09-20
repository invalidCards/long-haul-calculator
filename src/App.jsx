import { useEffect, useState } from 'react'
import LongHaulTracker from './pages/LongHaulTracker.jsx'

const UPDATE_MESSAGE = 'long-haul:activate-update'

function AppUpdateBanner() {
  const [waitingWorker, setWaitingWorker] = useState(null)
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined
    let disposed = false
    const showWaitingUpdate = (registration) => {
      if (!disposed && navigator.serviceWorker.controller && registration.waiting) setWaitingWorker(registration.waiting)
    }
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
        showWaitingUpdate(registration)
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') showWaitingUpdate(registration)
          })
        })
      } catch {
        // The calculator remains usable online if installation is unavailable.
      }
    }
    void register()
    return () => { disposed = true }
  }, [])

  if (!waitingWorker) return null
  const applyUpdate = () => {
    if (isApplyingUpdate) return
    setIsApplyingUpdate(true)
    waitingWorker.addEventListener('statechange', () => {
      if (waitingWorker.state === 'activated') window.location.reload()
    }, { once: true })
    waitingWorker.postMessage({ type: UPDATE_MESSAGE })
  }
  return <aside className="app-update-banner" role="status"><span>An update is ready.</span><button className="primary-button" type="button" disabled={isApplyingUpdate} onClick={applyUpdate}>{isApplyingUpdate ? 'Updating…' : 'Reload'}</button></aside>
}

export default function App() {
  return <><LongHaulTracker /><AppUpdateBanner /></>
}
