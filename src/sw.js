import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

const appShell = new URL('index.html', self.registration.scope).pathname
registerRoute(new NavigationRoute(createHandlerBoundToURL(appShell)))

self.addEventListener('message', (event) => {
  if (event.data?.type === 'long-haul:activate-update') event.waitUntil(self.skipWaiting())
})
