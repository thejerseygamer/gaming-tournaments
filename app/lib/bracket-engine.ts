export type GeneratedMatch = {
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  status: "pending" | "completed";
};

function shuffleArray<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const currentItem = shuffled[index];

    shuffled[index] = shuffled[randomIndex];
    shuffled[randomIndex] = currentItem;
  }

  return shuffled;
}

function getNextPowerOfTwo(value: number) {
  let power = 1;

  while (power < value) {
    power *= 2;
  }

  return power;
}

function getRoundCount(bracketSize: number) {
  return Math.log2(bracketSize);
}

function makeMatchKey(round: number, matchNumber: number) {
  return `${round}-${matchNumber}`;
}

function getNextMatchNumber(matchNumber: number) {
  return Math.ceil(matchNumber / 2);
}

function shouldPlaceWinnerInPlayer1(matchNumber: number) {
  return matchNumber % 2 === 1;
}

export function generateSingleEliminationBracket(
  tournamentId: string,
  playerIds: string[]
): GeneratedMatch[] {
  const uniquePlayerIds = Array.from(new Set(playerIds)).filter(Boolean);

  if (uniquePlayerIds.length < 2) {
    return [];
  }

  const shuffledPlayers = shuffleArray(uniquePlayerIds);

  const bracketSize = getNextPowerOfTwo(shuffledPlayers.length);
  const totalRounds = getRoundCount(bracketSize);
  const firstRoundMatchCount = bracketSize / 2;
  const byeCount = bracketSize - shuffledPlayers.length;
  const pairedMatchCount = firstRoundMatchCount - byeCount;

  const matchesByKey: Record<string, GeneratedMatch> = {};

  for (let round = 1; round <= totalRounds; round++) {
    const matchCount = bracketSize / Math.pow(2, round);

    for (let matchNumber = 1; matchNumber <= matchCount; matchNumber++) {
      const key = makeMatchKey(round, matchNumber);

      matchesByKey[key] = {
        tournament_id: tournamentId,
        round,
        match_number: matchNumber,
        player1_id: null,
        player2_id: null,
        winner_id: null,
        player1_score: null,
        player2_score: null,
        status: "pending",
      };
    }
  }

  let playerIndex = 0;

  for (let matchNumber = 1; matchNumber <= pairedMatchCount; matchNumber++) {
    const key = makeMatchKey(1, matchNumber);
    const match = matchesByKey[key];

    match.player1_id = shuffledPlayers[playerIndex] || null;
    playerIndex += 1;

    match.player2_id = shuffledPlayers[playerIndex] || null;
    playerIndex += 1;
  }

  for (
    let matchNumber = pairedMatchCount + 1;
    matchNumber <= firstRoundMatchCount;
    matchNumber++
  ) {
    const key = makeMatchKey(1, matchNumber);
    const match = matchesByKey[key];

    match.player1_id = shuffledPlayers[playerIndex] || null;
    playerIndex += 1;

    match.player2_id = null;

    if (match.player1_id) {
      match.winner_id = match.player1_id;
      match.status = "completed";
    }
  }

  for (let round = 1; round < totalRounds; round++) {
    const matchCount = bracketSize / Math.pow(2, round);

    for (let matchNumber = 1; matchNumber <= matchCount; matchNumber++) {
      const currentMatchKey = makeMatchKey(round, matchNumber);
      const currentMatch = matchesByKey[currentMatchKey];

      if (!currentMatch?.winner_id) {
        continue;
      }

      const nextRound = round + 1;
      const nextMatchNumber = getNextMatchNumber(matchNumber);
      const nextMatchKey = makeMatchKey(nextRound, nextMatchNumber);
      const nextMatch = matchesByKey[nextMatchKey];

      if (!nextMatch) {
        continue;
      }

      if (shouldPlaceWinnerInPlayer1(matchNumber)) {
        nextMatch.player1_id = currentMatch.winner_id;
      } else {
        nextMatch.player2_id = currentMatch.winner_id;
      }
    }
  }

  return Object.values(matchesByKey).sort((a, b) => {
    if (a.round !== b.round) {
      return a.round - b.round;
    }

    return a.match_number - b.match_number;
  });
}