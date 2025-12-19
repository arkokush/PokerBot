import random

rank_map = {
    "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6, "9": 7,
    "T": 8, "J": 9, "Q": 10, "K": 11, "A": 12,
}

suit_map = {
    "C": 0, "D": 1, "H": 2, "S": 3,
    "c": 0, "d": 1, "h": 2, "s": 3,
}

# Reverse maps
rank_reverse_map = {value: key for key, value in rank_map.items()}
suit_reverse_map = {v: k.lower() for k, v in suit_map.items() if k.isupper()}


class Card:
    __slots__ = ['id']

    # minimal fix: only ONE __init__
    def __init__(self, value):
        """
        Allows:
            Card(id_int)
            Card("As")  # string like "Ah", "TC"
            Card((rank, suit))
        """
        if isinstance(value, int):
            self.id = value

        elif isinstance(value, str):
            rank = value[0]
            suit = value[1]
            self.id = rank_map[rank] * 4 + suit_map[suit]

        elif isinstance(value, tuple):
            rank, suit = value
            self.id = rank_map[rank] * 4 + suit_map[suit]

        else:
            raise TypeError("Card constructor expects int, str (e.g. 'Ah'), or (rank,suit) tuple")

    def getRank(self):
        return rank_reverse_map[self.id // 4]

    def getSuit(self):
        return suit_reverse_map[self.id % 4]

    def getCardVal(self):
        return f"{self.getRank()}{self.getSuit()}"

    def __hash__(self):
        return hash(self.id)

    def __eq__(self, other):
        if isinstance(other, Card):
            return self.id == other.id
        if isinstance(other, int):
            return self.id == other
        if isinstance(other, str):
            return self.getCardVal() == other
        return False

    def __str__(self):
        return self.getCardVal()

    __repr__ = __str__


class Deck:
    def __init__(self):
        self.cards = [Card(i) for i in range(52)]

    def shuffle(self):
        random.shuffle(self.cards)

    def deal(self, n):
        return [self.cards.pop() for _ in range(n)]

    def size(self):
        return len(self.cards)

    def __len__(self):
        return len(self.cards)


def main():
    deck = Deck()
    deck.shuffle()

    for card in deck.cards:
        print(card)

    print(f'Cards Amount: {len(deck)}')


if __name__ == "__main__":
    main()
