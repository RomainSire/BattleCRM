export default defineContentScript({
  matches: ['*://www.linkedin.com/in/*'],
  main() {
    console.log('BattleCRM content script loaded on', location.href)
  },
})
