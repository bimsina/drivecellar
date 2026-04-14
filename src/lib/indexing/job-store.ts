import type { IndexJobState } from './types.ts'

const jobsByConnection = new Map<string, IndexJobState>()

export function getIndexJob(connectionId: string) {
  return jobsByConnection.get(connectionId)
}

export function setIndexJob(job: IndexJobState) {
  jobsByConnection.set(job.connectionId, job)
}

export function clearIndexJob(connectionId: string, jobId?: string) {
  const current = jobsByConnection.get(connectionId)

  if (!current) {
    return
  }

  if (jobId && current.jobId !== jobId) {
    return
  }

  jobsByConnection.delete(connectionId)
}

export function cancelIndexJob(connectionId: string) {
  const job = jobsByConnection.get(connectionId)

  if (!job) {
    return false
  }

  job.abortController.abort()
  return true
}
