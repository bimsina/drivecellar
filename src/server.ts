import { FastResponse } from 'srvx'
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

import { startReindexScheduler } from '#/lib/indexing/scheduler.ts'

startReindexScheduler()

// Nitro uses srvx internally for Node deployments, so swapping in FastResponse
// lets the runtime use srvx's optimized Node response path.
globalThis.Response = FastResponse

export default createServerEntry({
  fetch(request, opts) {
    return handler.fetch(request, opts)
  },
})
