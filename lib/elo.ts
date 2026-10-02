export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function kFactor(gamesPlayed: number): number {
  return gamesPlayed < 30 ? 32 : 16;
}

export function newRating(
  rating: number,
  gamesPlayed: number,
  opponentRating: number,
  actualScore: 0 | 0.5 | 1
): number {
  const k = kFactor(gamesPlayed);
  const expected = expectedScore(rating, opponentRating);
  return Math.round(rating + k * (actualScore - expected));
}
