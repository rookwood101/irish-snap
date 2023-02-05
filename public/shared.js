export const cardValues = ["Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"]
export const cardSuits = ["Spades", "Hearts", "Diamonds", "Clubs"]
export const allCards = cardValues.flatMap((v) => cardSuits.map((s) => [v, s]));

export function deal(numPlayers) {
    const deck = allCards.slice()
    shuffleArray(deck)
    return splitArray(deck, numPlayers)
}
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
function splitArray(array, nChunks) {
    let result = [];
    for (let i = nChunks; i > 0; i--) {
        result.push(array.splice(0, Math.ceil(array.length / i)));
    }
    return result;
}