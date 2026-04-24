import type { ReadRange } from './types.ts'

type FullRangeResult = {
  status: 'full'
}

type PartialRangeResult = {
  status: 'partial'
  range: Required<ReadRange>
  contentLength: number
  contentRange: string
}

type UnsatisfiableRangeResult = {
  status: 'unsatisfiable'
  contentRange: string
}

export type RangeResult =
  | FullRangeResult
  | PartialRangeResult
  | UnsatisfiableRangeResult

export function parseRangeHeader(
  rangeHeader: string | null,
  size: number | null,
): RangeResult {
  if (!rangeHeader) {
    return { status: 'full' }
  }

  if (size == null || size < 0) {
    return { status: 'full' }
  }

  if (rangeHeader.includes(',')) {
    return { status: 'unsatisfiable', contentRange: `bytes */${size}` }
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) {
    return { status: 'unsatisfiable', contentRange: `bytes */${size}` }
  }

  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) {
    return { status: 'unsatisfiable', contentRange: `bytes */${size}` }
  }

  let start: number
  let end: number

  if (!rawStart) {
    const suffixLength = Number(rawEnd)
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return { status: 'unsatisfiable', contentRange: `bytes */${size}` }
    }
    start = Math.max(size - suffixLength, 0)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd ? Number(rawEnd) : size - 1
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return { status: 'unsatisfiable', contentRange: `bytes */${size}` }
  }

  end = Math.min(end, size - 1)

  return {
    status: 'partial',
    range: { start, end },
    contentLength: end - start + 1,
    contentRange: `bytes ${start}-${end}/${size}`,
  }
}
