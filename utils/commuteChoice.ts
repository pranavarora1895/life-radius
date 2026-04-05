export type CommuteChoice = 'walk' | 'transit'

/**
 * Pick walk vs public-transit duration for scoring. Very short walks stay on foot; longer legs need a clear transit time win.
 */
export function chooseWalkOrTransit(
  walkSeconds: number,
  transitSeconds: number | null,
): { choice: CommuteChoice; seconds: number; reason: string } {
  if (
    transitSeconds == null ||
    !Number.isFinite(transitSeconds) ||
    transitSeconds <= 0 ||
    transitSeconds > 86400
  ) {
    return {
      choice: 'walk',
      seconds: walkSeconds,
      reason: 'No transit time for this trip — walking only.',
    }
  }

  const walkMin = walkSeconds / 60

  /** Under ~5 min walk: transit usually isn’t realistic; always count walking. */
  if (walkMin <= 5) {
    return {
      choice: 'walk',
      seconds: walkSeconds,
      reason: 'Short walk — we count this trip on foot.',
    }
  }

  /** Under ~15 min walk: need transit to be at least ~4 min faster or we keep walking. */
  if (walkMin <= 15) {
    if (walkSeconds - transitSeconds >= 240) {
      return {
        choice: 'transit',
        seconds: transitSeconds,
        reason: 'Transit is clearly faster here, so we used that time for your score.',
      }
    }
    return {
      choice: 'walk',
      seconds: walkSeconds,
      reason: 'Walkable trip — we keep walking unless transit is much faster.',
    }
  }

  if (walkSeconds <= transitSeconds + 120) {
    return {
      choice: 'walk',
      seconds: walkSeconds,
      reason: 'Walking is about as fast as transit for this trip.',
    }
  }

  return {
    choice: 'transit',
    seconds: transitSeconds,
    reason: 'Transit looks clearly faster, so we used that time for your score.',
  }
}
