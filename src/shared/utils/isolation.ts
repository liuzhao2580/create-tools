// Pages cannot set COOP/COEP headers. The same-origin worker adds them after one reload.
export async function prepareIsolation(): Promise<void> {
  if (crossOriginIsolated || !isSecureContext || !('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register(new URL('./coi-serviceworker.js', document.baseURI), { scope: './' })
    await navigator.serviceWorker.ready
    const reload = () => {
      try {
        if (sessionStorage.getItem('shengzuo.isolation-reload') !== '1') {
          sessionStorage.setItem('shengzuo.isolation-reload', '1')
          location.reload()
        }
      } catch { /* Capability check will explain when isolation is unavailable. */ }
    }
    if (navigator.serviceWorker.controller) reload()
    else navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
  } catch { /* The app remains usable and displays the capability failure. */ }
}
