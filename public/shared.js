export const cardValues = ["Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"]
export const cardSuits = ["Spades", "Hearts", "Diamonds", "Clubs"]
export const allCards = cardValues.flatMap((v) => cardSuits.map((s) => [v, s]));