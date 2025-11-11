import random

class Card:
    def __init__(self, suit, value):
        self.suit = suit
        self.value = value

class Deck:
    def __init__(self):
        self.cards = []
        for suit in ["Hearts", "Diamonds", "Clubs", "Spades"]:
            for value in range(2, 10):
                self.cards.append(Card(suit, value))
            for value in ["J", "Q", "K", "A"]:
                self.cards.append(Card(suit, value))

    def shuffle(self):
        random.shuffle(self.cards)

    def deal(self, n):
        dealt = []
        for i in range(n):
            dealt.append(self.cards.pop())
        return dealt

    def size(self):
        return len(self.cards)

def main():
    deck = Deck()
    deck.shuffle()
    for card in deck.cards:
        print(f"{card.value} of {card.suit}")

if __name__ == "__main__":
    main()

