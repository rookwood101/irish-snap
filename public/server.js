import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { produce } from "immer"

import { Move, Phase } from "./shared.js"
import * as StateTransitions from "./stateTransitions.js"
import * as StateQueries from "./stateQueries.js"

const app = express()
const server = createServer(app)
const io = new Server(server)

app.use(express.static("public"))

class IrishSnapServer {
    constructor() {
        this.state = {}
        StateTransitions.initialise(this.state)
    }

    #updateState(stateUpdater) {
        const newState = produce(this.state, stateUpdater)
        console.log(newState)
        this.state = newState
        Object.entries(this.state.players).forEach(([playerId, player]) => {
            player.updateState(StateQueries.clientState(this.state, playerId))
        })
    }

    addPlayer(id, playerName, stateUpdater) {
        this.#updateState((draftState) => {
            StateTransitions.addPlayer(draftState, id, playerName, stateUpdater)
        })
    }

    removePlayer(id) {
        this.#updateState((draftState) => {
            StateTransitions.removePlayer(draftState, id)
        })
    }

    playerName(id) {
        return StateQueries.playerName(this.state, id)
    }

    onMove(playerId, move, payload) {
        this.#updateState(draftState => {
            switch (move) {
                case Move.SayAndPlay:
                    switch (this.state.phase) {
                        case Phase.Playing:
                            StateTransitions.sayAndPlay(draftState, playerId, payload)
                            break
                        case Phase.Slapping:
                            StateTransitions.uncheckedSayAndPlay(draftState, playerId, payload)
                            StateTransitions.foul(draftState, playerId, `${StateQueries.playerName(draftState, playerId)} played a card when they should've slapped!`)
                            break
                        default:
                            break
                    }
                    break
                case Move.Slap:
                    switch (this.state.phase) {
                        case Phase.Playing:
                            StateTransitions.slap(draftState, playerId)
                            break
                        case Phase.Slapping:
                            StateTransitions.slap(draftState, playerId)
                            break
                        default:
                            break
                    }
                    break
                default:
                    break
            }
        })
        
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

const port = process.env.IRISH_SNAP_PORT || 8000
server.listen(port, () => {
    console.log(`listening on *:${port}`)
})