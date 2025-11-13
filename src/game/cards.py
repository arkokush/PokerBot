import random

class Card:
    __slots__ = ['suit','rank','id']

    def __init__(self, suit, rank):
        self.suit = suit
        self.rank = rank
        rank_map = {
            "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6, "9": 7,
            "T": 8, "J": 9, "Q": 10, "K": 11, "A": 12,
        }
        suit_map = {
            "C": 0, "D": 1, "H": 2, "S": 3,
            "c": 0, "d": 1, "h": 2, "s": 3,
        }
        self.id = rank_map[rank]*4 + suit_map[suit]

    def __str__(self):
        return f"{self.rank} of {self.suit}"

class Deck:
    def __init__(self):
        self.cards = []
        for suit in ["H", "D", "C", "S"]:
            for rank in ['2','3','4','5','6','7','8','9','T','J', 'Q', 'K', 'A']:
                self.cards.append(Card(suit, rank))

    def shuffle(self):
        random.shuffle(self.cards)

    def deal(self, n):
        return [self.cards.pop() for _ in range(n)]

    def size(self):
        return len(self.cards)

def main():
    deck = Deck()
    deck.shuffle()
    for card in deck.cards:
        print(card)

if __name__ == "__main__":
    main()
