import { h, render } from 'https://esm.sh/preact?dev'
import { useRef } from 'https://esm.sh/preact/hooks?dev'
import { signal } from "https://esm.sh/@preact/signals?dev"
import htm from "https://esm.sh/htm?dev"
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
    return html`<button class="say-and-play-button" onClick=${() => sayAndPlay(cardValue)}>${cardValue}</button>`
}

function OnCircle( { rotation, radius, children } ) {
    return html`
        <div class="card-table-seat-wrapper" style="
            transform: translate(-50%, -50%) rotate(${rotation}) translate(-${radius});
        ">
             <div style="
                transform: rotate(-${rotation});
            ">
                ${children}
            </div>
        </div>
    `
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
                    transform: rotate(${i*(360.0/nPlayers)}deg) translate(-28vmin);
                ">
                    <div class="card-table-seat-hand" style="
                        transform: rotate(-${i*(360.0/nPlayers)}deg) translate(-50%, -50%);
                    ">
                        <${PlayingCardStack} topCard="back" size=${playerData.handSize} />
                    </div>
                </div>
                <div class="card-table-seat-wrapper" style="
                    transform: translate(-50%, -50%) rotate(${i*(360.0/nPlayers)}deg) translate(-40vmin);
                    z-index: ${100+playerData.isSlapping};
                ">
                    <div class="slapper ${playerData.isSlapping ? " slapping" : ""}">
                        🤚\u{FE0F}
                    </div>
                </div>
            `)}
            <div class="card-table-center" onClick=${() => slap()}>
                <span>Press here to slap</span>
            </div>
            <div class="card-table-stack" onClick=${() => slap()}>
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

function Rules({ state }) {
    const dialog = useRef(null)

    return html`
    <button onClick=${() => dialog.current.showModal()}>Irish Snap Rules</button>
    <dialog ref=${dialog}>
        <h2>Irish Snap Rules</h2>
        <p>Players: 2+</p>
        <h3>The Objective</h3>
        <p>To lose all the cards in your hand.</p>
        <h3>The Deal</h3>
        <p>
            All the players sit around a table, so that they can all reach the centre.
            All the cards are dealt out, to all the players.
            Cards remain face-down and players may not look at their cards.
        </p>
        <h3>The Play</h3>
        <p>
            Starting with the person to the dealer's left (indicated by "1st" icon).
            They initiate play by turning over their top card and placing it into the centre, face-up, saying "Ace" (by pressing the buttons).
            The player on his left then puts their top card face-up on top of his, while saying "Two".
            Play continues in this way (going "Ace", "Two", ... "Nine", "Ten", "Jack", "Queen", "King", "Ace", "Two", etc) until one (or more!) of the following occurs:
        </p>
        <ul>
            <li>The card just played matches the card underneath (same as normal snap).</li>
            <li>The card just played matches the card number spoken by the player (e.g. they put down an Ace while saying "Ace").</li>
            <li>A Jack is played.</li>
        </ul>
        <p>
            At this point, all the players must slap their hands on top of the pile of cards in the centre, as fast as possible.
            The last player to do so takes the entire pile and puts them on the bottom of the pile in their hand.
            This player then starts the next round, resuming from "Ace".
        </p>
        <p>If any player slaps or flinches without these conditions being met, they forfeit the round and pick up all the cards in the centre.</p>
        <p>
            When a player has used all their cards, they continue to say numbers in turn, and still have to slap when required.
            Only when one player has all the cards does the game end.
        </p>
        <form method="dialog">
            <input type="submit" value="Close" />
        </form>
    </dialog>
    `
}

function App(props) {
    const s = state.value;
    // TODO: contesting rule violations should be done by players, not the server
    // TODO: timeout if player takes too long
    // TODO: add slap reason
    // TODO: if you slap/play incorrectly at the start of the round then starting player shouldn't rotate
    // TODO: if you're out then you can keep playing but don't place any cards
    return html`
        <${Rules} />
        <${WinningMessage} state=${s} />
        <${CardTable} state=${s} />
        <div class="buttons">
            <div>
                ${cardValues.map((cardValue, i) => html`
                    <!-- <${OnCircle} rotation="${i*(360.0/cardValues.length)}deg" radius="40vmin"> -->
                        <${SayAndPlayButton} cardValue=${cardValue} />
                    <!-- </${OnCircle}> -->
                `)}
            </div>
        </div>
        <ul class="message-feed">
            ${s.eventLog.slice(-2).reverse().map((message) => html`<li>${message}</li>`)}
        </ul>
    `
}

render(html`<${App} />`, document.body);