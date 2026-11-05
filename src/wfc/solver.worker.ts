// The WFC Web Worker: solves chunks off the main thread. All logic is in protocol.ts so it
// can be tested without a worker.

import { handleSolveChunkRequest, type SolveChunkRequest } from './protocol'

self.onmessage = (e: MessageEvent<SolveChunkRequest>) => {
  self.postMessage(handleSolveChunkRequest(e.data))
}
