// Generic response for endpoints that only return a localized message
// (logout, delete/archive, cancel, password flows, backup import…)
export type MessageResponse = {
  message: string
}
