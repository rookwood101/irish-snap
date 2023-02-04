import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { produce } from "immer"

import { cardValues, cardSuits, allCards } from "./shared.js"

const app = express()
const server = createServer(app)
const io = new Server(server)

app.use(express.static("public"))

class IrishSnapServer {
    constructor() {
        // initial state
        this.state = {
            status: "Need to deal out the cards",
            moves: [],
            played: [],
            said: [],
            players: {},
        }
        this.#updateState((draft) => draft)
    }

    #deal(numPlayers) {
        const deck = allCards.slice()
        this.#shuffleArray(deck)
        return this.#splitArray(deck, numPlayers)
    }
    #shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    #splitArray(array, nChunks) {
        let result = [];
        for (let i = nChunks; i > 0; i--) {
            result.push(array.splice(0, Math.ceil(array.length / i)));
        }
        return result;
    }

    /** The card value expected to be said next */
    #expectedToSayNext() {
        const saidLast = this.state.said[this.state.said.length - 1] ?? "King"
        return cardValues[(cardValues.indexOf(saidLast) + 1) % cardValues.length]
    }

    /** The player expected to play next */
    #expectedToPlayNext() {
        const playerOrder = Object.keys(this.state.players)
        const lastSayAndPlay = this.state.moves.slice().reverse().find((move) => move.action === "sayAndPlay")
        if (lastSayAndPlay === undefined) {
            return playerOrder[0]
        }
        return playerOrder[(playerOrder.indexOf(lastSayAndPlay.player) + 1) % playerOrder.length]
    }

    #shouldSlap() {
        const saidLast = this.state.said[this.state.said.length - 1] ?? NaN
        const playedLastLast = this.state.played[this.state.played.length - 2]?.[0] ?? NaN
        const playedLast = this.state.played[this.state.played.length - 1]?.[0] ?? NaN

        return saidLast === playedLast || playedLastLast === playedLast || playedLast === "Jack"
    }

    #updateState(stateUpdater) {
        const newState = produce(this.state, stateUpdater)
        console.log(newState)
        this.state = newState
        Object.entries(this.state.players).forEach(([playerId, player]) => {
            player.updateState({
                currentPlayer: {
                    id: playerId,
                    name: player.name,
                },
                lastMove: this.state.moves[this.state.moves.length - 1],
                playedLast: this.state.played[this.state.played.length - 1],
                stackSize: this.state.played.length,
                players: Object.fromEntries(Object.entries(this.state.players).map(
                    ([playerId, playerData]) => [playerId, { name: playerData.name, handSize: playerData.hand.length }]
                )),
                status: this.state.status,
            })
        })
    }

    addPlayer(id, playerName, stateUpdater) {
        this.#updateState((draftState) => {
            draftState.players[id] = {
                name: playerName,
                hand: [],
                updateState: stateUpdater,
            }
        })
    }

    removePlayer(id) {
        this.#updateState((draftState) => {
            delete draftState.players[id]
        })
    }

    playerName(playerId) {
        return this.state.players[playerId]?.name
    }

    onMove(playerId, move, payload) {
        const playerName = this.playerName(playerId)
        switch (move) {
            case "sayAndPlay":
                if (this.state.status !== "valid") {
                    return
                }
                const said = payload
                const expectedToSayNext = this.#expectedToSayNext()
                const expectedToPlayNext = this.#expectedToPlayNext()

                this.#updateState(draftState => {
                    const played = draftState.players[playerId].hand.pop()
                    draftState.moves.push({
                        timestamp: new Date(),
                        action: move,
                        played,
                        said,
                        player: playerId,
                    })
                    draftState.played.push(played)
                    draftState.said.push(said)
                    if (this.#shouldSlap()) {
                        draftState.status = `Somebody should've slapped!`
                        return
                    }
                    if (expectedToPlayNext !== playerId) {
                        draftState.status = `Player ${this.playerName(expectedToPlayNext)} should've gone, not you ${playerName ?? "unknown player"}!\n`
                        return
                    }
                    if (said !== expectedToSayNext) {
                        draftState.status = `Player ${playerName} should've said ${expectedToSayNext}!\n`
                        return
                    }
                })
                break
            case "slap":
                if (this.state.status !== "valid") {
                    return
                }
                this.#updateState(draftState => {
                    draftState.moves.push({
                        timestamp: new Date(),
                        action: move,
                        player: playerId,
                    })
                    if (this.#shouldSlap()) {
                        draftState.status = `Player ${playerName} slapped first!`
                    } else {
                        draftState.status = `Player ${playerName} shouldn't have slapped!`
                    }
                })
                break
            case "deal":
                this.#updateState(draftState => {
                    const playerIds = Object.keys(draftState.players)
                    const hands = this.#deal(playerIds.length)
                    playerIds.forEach((playerId, i) => {
                        draftState.players[playerId].hand = hands[i]
                    })
                    draftState.moves = []
                    draftState.played = []
                    draftState.said = []
                    draftState.status = "valid"
                })
                break
            default:
                break
        }
    }
}

const irishSnap = new IrishSnapServer()

io.on("connection", (socket) => {
    socket.on("disconnect", () => {
        console.log(`${irishSnap.playerName(socket.id) ?? "unknown user"} disconnected`)
        irishSnap.removePlayer(socket.id)
    })
    socket.on("join", ({ name, _room }) => {
        irishSnap.addPlayer(socket.id, name, (newState) => {
            socket.emit("updateState", newState)
        })
    })
    socket.onAny((event, payload) => {
        if (!event.startsWith("move:")) {
            return
        }
        const move = event.replace("move:", "")
        irishSnap.onMove(socket.id, move, payload)
    })
})

server.listen(8000, () => {
    console.log("listening on *:8000")
})