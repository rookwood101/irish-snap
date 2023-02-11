import { h, Component, render } from 'https://esm.sh/preact@10.11.3'
import { signal } from "https://esm.sh/@preact/signals@1.1.3"
import htm from "https://esm.sh/htm@3.1.1"
import { io } from "/socket.io/socket.io.esm.min.js"

import { cardValues, cardSuits, allCards, Move, Phase } from "./shared.js"
import * as StateTransitions from "./stateTransitions.js"
import * as StateQueries from "./stateQueries.js"

const socket = io()

// Initialize htm with Preact
const html = htm.bind(h)

function initialState() {
    const state = {}
    const tempPlayerId = 1
    StateTransitions.initialise(state)
    StateTransitions.addPlayer(state, tempPlayerId, undefined, () => {})

    return StateQueries.clientState(state, tempPlayerId)
}

const state = signal(initialState());

(function initialise() {
    const regex_emoji = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/u
    let username = localStorage.getItem("username")
    while (!regex_emoji.test(username)) {
        username = [...prompt("Choose an emoji for your username (win+. to open emoji picker):")][0]
    }
    localStorage.setItem("username", username)

    // preload card images
    allCards.forEach((card) => {
        new Image().src = getPlayingCardSvgPath(card)
    })

    socket.on("connect", () => {
        socket.emit("join", {
            name: username,
            room: "default",
        })
    })
    socket.on("updateState", (newState) => {
        console.log(newState)
        state.value = newState
    })
})()

function sayAndPlay(said) {
    socket.emit(`move:${Move.SayAndPlay}`, said)
}

function slap() {
    socket.emit(`move:${Move.Slap}`, null)
}

function getPlayingCardSvgPath(card) {
    let svgIdentifier = "uu" // fallback
    if (card === "back") {
        svgIdentifier = "back"
    }
    else if (card) {
        const value = card[0]
        const suit = card[1]

        svgIdentifier = `${value === "10" ? "10" : value[0]}${suit[0]}`
    }

    return `images/Minicard_${svgIdentifier}.svg`
}

function PlayingCardStack({ topCard, size }) {
    if (!topCard || size === 0) {
        return null
    }
    const maxOffset = 0.7
    const maxCards = 52
    const offset = size * (maxOffset / maxCards)
    return html`
        <div class="playing-card-stack-wrapper">
            <img class="playing-card-stack" src=${getPlayingCardSvgPath(topCard)} style="
                --offset: ${offset}vmin
            "/>
        </div>
    `
}

function SayAndPlayButton({ cardValue }) {
    return html`<button onClick=${() => sayAndPlay(cardValue)}>${cardValue}</button>`
}

function CardTable({ state }) {
    const players = state.players
    const nPlayers = Object.keys(players).length
    const myPlayerId = state.currentPlayer.id
    return html`
        <div class="card-table">
            ${Object.entries(players).map(([playerId, playerData], i) => html`
                <div class="card-table-seat-wrapper" style="
                    transform: rotate(${i*(360.0/nPlayers)}deg) translate(-40vmin);
                ">
                    <div class="card-table-seat" style="
                        transform: rotate(-${i*(360.0/nPlayers)}deg) translate(-50%, -50%);
                        border: 1.6vmin solid ${playerId === myPlayerId ? "black" : "saddlebrown"};
                    ">
                        <span class="card-table-player-name">${playerData.name}</span>
                        ${state.lastMove?.action === Move.SayAndPlay && state.lastMove?.player === playerId && html`
                            <div class="speech-bubble">
                                ${state.lastMove?.player === playerId ? state.lastMove?.said : undefined}
                            </div>
                        `}
                        ${playerData.isStartingPlayer && html`<div class="player-one-token"><div>1st</div></div>`}
                    </div>
                </div>
                <div class="card-table-seat-wrapper" style="
                    transform: rotate(${i*(360.0/nPlayers)}deg) translate(-25vmin);
                ">
                    <div class="card-table-seat-hand" style="
                        transform: rotate(-${i*(360.0/nPlayers)}deg) translate(-50%, -50%);
                    ">
                        <${PlayingCardStack} topCard="back" size=${playerData.handSize} />
                    </div>
                </div>
            `)}
            <div class="card-table-center" />
            <div class="card-table-stack">
                <${PlayingCardStack} topCard=${state.playedLast} size=${state.stackSize} />
            </div>
        </div>
    `
}

function WinningMessage({ state }) {
    if (state.phase !== Phase.Winning) {
        return null
    }
    const winner = Object.values(state.players).find((player) => player.handSize === 0)
    return html`
        <div class="winning-message">Congratulations ${winner.name}, you win!</div>
    `
}

function App(props) {
    const s = state.value;
    // TODO: contesting rule violations should be done by players, not the server
    // TODO: timeout if player takes too long
    // TODO: click in the center to slap
    // TODO: add slap reason
    // TODO: if you slap/play incorrectly at the start of the round then starting player shouldn't rotate
    // TODO: if you're out then you can keep playing but don't place any cards
    return html`
        <div>
            <${WinningMessage} state=${s} />
            <div style="
                display: flex;
                justify-content: center;
            ">
                <${CardTable} state=${s} />
            </div>
            <div style="
                display: flex;
                justify-content: center;
            ">
                <div>
                    <div>${s.currentPlayer.name} controls</div>
                    <div>
                        ${cardValues.map((cardValue) => html`<${SayAndPlayButton} cardValue=${cardValue} />`)}
                        <button onClick=${() => slap()}>Slap!</button>
                    </div>
                </div>
                <ul class="message-feed">
                    ${s.eventLog.slice(-5).reverse().map((message) => html`<li>${message}</li>`)}
                </ul>
            </div>
        </div>
    `
}

render(html`<${App} />`, document.body);