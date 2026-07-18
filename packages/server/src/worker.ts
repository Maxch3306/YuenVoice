import { createApp } from './http/app.js'

// Durable Object class must be exported from the Worker entry.
export { SessionStore } from './durable/SessionStore.js'

const app = createApp()

export default {
  fetch: app.fetch,
}
