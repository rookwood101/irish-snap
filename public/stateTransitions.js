import { createHands, Move, Phase } from "./shared.js"
import * as StateQueries from "./stateQueries.js"

export function initialise(draftState) {
    draftState.phase = Phase.WaitingForPlayers
    draftState.moves = []
    draftState.played = []
    draftState.said = []
    draftState.slapped = []
    draftState.players = {}
    draftState.eventLog = []
    draftState.rounds = []
}

export function newRound(draftState) {
    draftState.phase = Phase.Playing
    draftState.rounds.push(draftState.moves)
    draftState.moves = []
    draftState.played = []
    draftState.said = []
    draftState.slapped = []

    advanceStartingPlayer(draftState)
    const startingPlayerName = StateQueries.playerName(draftState, StateQueries.startingPlayer(draftState))
    // too noisy in the log, but now that we delay, ok
    event(draftState, `Round ${StateQueries.roundNumber(draftState)}. Starting player: ${startingPlayerName}`)

    // stay the same:
    // draftState.players
    // draftState.eventLog
}

export function reset(draftState) {
    const players = draftState.players
    const playerIds = Object.keys(players)
    const hands = createHands(playerIds.length)

    initialise(draftState)

    playerIds.forEach((playerId, i) => {
        draftState.players[playerId] = {
            name: players[playerId].name,
            hand: hands[i],
            updateState: players[playerId].updateState,
            isStartingPlayer: i === 0,
        }
    })
    draftState.phase = Phase.Playing
    const startingPlayerName = StateQueries.playerName(draftState, StateQueries.startingPlayer(draftState))
    event(draftState, `Round 1. Starting player: ${startingPlayerName}`)
}


export function addPlayer(draftState, id, playerName, stateUpdater) {
    draftState.players[id] = {
        name: playerName,
        hand: [],
        updateState: stateUpdater,
        isStartingPlayer: undefined,
    }
    reset(draftState)
}

export function removePlayer(draftState, id) {
    delete draftState.players[id]
    reset(draftState)
}

function advanceStartingPlayer(draftState) {
    const players = Object.values(draftState.players)
    const startingPlayerIndex = players.findIndex((player) => player.isStartingPlayer)
    players[startingPlayerIndex].isStartingPlayer = false
    players[(startingPlayerIndex + 1) % players.length].isStartingPlayer = true
}


export function error(draftState, message) {
    console.error(message)
    draftState.phase = Phase.Erroring
}

export function event(draftState, message) {
    draftState.eventLog.push(message)
}

export function foul(draftState, playerId, reason) {
    draftState.players[playerId].hand.unshift(...draftState.played.reverse())
    draftState.played = []
    draftState.phase = Phase.Fouling
    draftState.eventLog.push(reason)

    // TODO: the handling of new rounds outside of this makes me uneasy
    // newRound(draftState)
}

export function sayAndPlay(draftState, playerId, said) {
    const expectedToSayNext = StateQueries.expectedToSayNext(draftState)
    const expectedToPlayNext = StateQueries.expectedToPlayNext(draftState)
    const shouldSlap = StateQueries.shouldSlap(draftState)

    uncheckedSayAndPlay(draftState, playerId, said)

    const playerName = StateQueries.playerName(draftState, playerId)
    if (shouldSlap) {
        foul(draftState, playerId, `Somebody should've slapped! Instead, ${playerName} played a card.`)
        return
    }
    if (expectedToPlayNext !== playerId) {
        foul(draftState, playerId, `${StateQueries.playerName(draftState, expectedToPlayNext)} should've played a card! Instead, ${playerName} did.`)
        return
    }
    if (said !== expectedToSayNext) {
        foul(draftState, playerId, `${playerName} should've said ${expectedToSayNext}! Instead, they said ${said}.`)
        return
    }
}

export function uncheckedSayAndPlay(draftState, playerId, said) {
    const played = draftState.players[playerId].hand.pop()
    draftState.moves.push({
        timestamp: new Date(),
        action: Move.SayAndPlay,
        played,
        said,
        player: playerId,
    })
    if (played) {
        draftState.played.push(played)
    }
    draftState.said.push(said)
}


export function slap(draftState, playerId) {
    const remainingPlayersToSlap = Object.keys(draftState.players).filter(p => !draftState.slapped.includes(p));
    const alreadySlapped = draftState.slapped.includes(playerId)

    draftState.moves.push({
        timestamp: new Date(),
        action: Move.Slap,
        player: playerId,
    })
    draftState.slapped.push(playerId)

    const playerName = StateQueries.playerName(draftState, playerId)
    if (!StateQueries.shouldSlap(draftState)) {
        foul(draftState, playerId, `Player ${playerName} shouldn't have slapped!`)
        return
    }
    draftState.phase = Phase.Slapping
    if (alreadySlapped) {
        return
    }
    if (draftState.players[playerId].hand.length === 0) {
        draftState.phase = Phase.Winning
    }
    if (remainingPlayersToSlap.length === 1 && remainingPlayersToSlap[0] === playerId) {
        foul(draftState, playerId, `${playerName} slapped last! Everyone else slapped quicker.`)
        return
    }
    event(draftState, `${playerName} slapped!`)
}