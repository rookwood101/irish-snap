import { cardValues, Move } from "./shared.js"

/** The card value expected to be said next */
export function expectedToSayNext(state) {
    const saidLast = state.said[state.said.length - 1] ?? "King"
    return cardValues[(cardValues.indexOf(saidLast) + 1) % cardValues.length]
}

/** The player expected to play next */
export function expectedToPlayNext(state) {
    const playerOrder = Object.keys(state.players)
    const lastSayAndPlay = state.moves.slice().reverse().find((move) => move.action === Move.SayAndPlay)
    if (lastSayAndPlay === undefined) {
        return startingPlayer(state)
    }
    return playerOrder[(playerOrder.indexOf(lastSayAndPlay.player) + 1) % playerOrder.length]
}

const nothingSaid = Symbol()
const nothingPlayedLastLast = Symbol()
const nothingPlayedLast = Symbol()

export function shouldSlap(state) {
    const saidLast = state.said[state.said.length - 1] ?? nothingSaid
    const playedLastLast = state.played[state.played.length - 2]?.[0] ?? nothingPlayedLastLast
    const playedLast = state.played[state.played.length - 1]?.[0] ?? nothingPlayedLast

    // the 3 symbol constants (nothingX) ensure that these values will never equal each other, even if undefined
    return saidLast === playedLast || playedLastLast === playedLast || playedLast === "Jack"
}

export function playerName(state, playerId) {
    return state.players[playerId]?.name ?? "Unknown player"
}

export function roundNumber(state) {
    return state.rounds.length + 1
}

export function startingPlayer(state) {
    return Object.keys(state.players).find((playerId) => state.players[playerId].isStartingPlayer)
}

export function clientState(state, playerId) {
    return {
        currentPlayer: {
            id: playerId,
            name: state.players[playerId].name,
        },
        lastMove: state.moves[state.moves.length - 1],
        playedLast: state.played[state.played.length - 1],
        stackSize: state.played.length,
        players: Object.fromEntries(Object.entries(state.players).map(
            ([playerId, playerData]) => [playerId, {
                name: playerData.name,
                handSize: playerData.hand.length,
                isStartingPlayer: playerData.isStartingPlayer,
                isSlapping: state.slapped.indexOf(playerId) + 1, // TODO: this is not the right place to do this
            }]
        )),
        eventLog: state.eventLog,
        roundNumber: roundNumber(state),
    }
}