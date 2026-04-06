export default defineBackground(() => {
  console.log('BattleCRM service worker initialized', { id: browser.runtime.id })
})
