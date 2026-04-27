import random
import pickle
from pathlib import Path
from functools import lru_cache
from phevaluator.evaluator import evaluate_cards
from src.utils.cards import rank_reverse_map, suit_reverse_map

NUM_BUCKETS = 8
DATA_PATH = Path(__file__).parent.parent.parent / "data" / "preflop_equity.pkl"


def card_to_str(card_id: int) -> str:
    return f"{rank_reverse_map[card_id // 4]}{suit_reverse_map[card_id % 4]}"


def preflop_key(c0: int, c1: int) -> str:
    """Canonical preflop key string e.g. 'AKs', 'AKo', 'AA'. 169 unique combos."""
    r0, s0 = c0 // 4, c0 % 4
    r1, s1 = c1 // 4, c1 % 4
    high, low = max(r0, r1), min(r0, r1)
    if high == low:
        return f"{rank_reverse_map[high]}{rank_reverse_map[low]}"
    suited = 's' if s0 == s1 else 'o'
    return f"{rank_reverse_map[high]}{rank_reverse_map[low]}{suited}"


@lru_cache(maxsize=100_000)
def mc_win_prob(hole_cards: tuple, board: tuple, k: int = 1000) -> float:
    """Estimate heads-up win probability via Monte Carlo rollouts."""
    known = set(hole_cards) | set(board)
    deck = [c for c in range(52) if c not in known]
    remaining = 5 - len(board)

    wins = 0.0
    for _ in range(k):
        sample = random.sample(deck, 2 + remaining)
        opp = sample[:2]
        full_board = list(board) + sample[2:]

        my_rank = evaluate_cards(*[card_to_str(c) for c in hole_cards], *[card_to_str(c) for c in full_board])
        opp_rank = evaluate_cards(*[card_to_str(c) for c in opp], *[card_to_str(c) for c in full_board])

        if my_rank < opp_rank:
            wins += 1.0
        elif my_rank == opp_rank:
            wins += 0.5

    return wins / k


@lru_cache(maxsize=100_000)
def river_win_prob(hole_cards: tuple, board: tuple) -> float:
    """Exact heads-up win probability on the river by enumerating all opponent holdings."""
    from itertools import combinations
    known = set(hole_cards) | set(board)
    deck = [c for c in range(52) if c not in known]
    board_strs = [card_to_str(c) for c in board]
    my_rank = evaluate_cards(*[card_to_str(c) for c in hole_cards], *board_strs)

    wins = 0.0
    total = 0
    for opp in combinations(deck, 2):
        opp_rank = evaluate_cards(*[card_to_str(c) for c in opp], *board_strs)
        if my_rank < opp_rank:
            wins += 1.0
        elif my_rank == opp_rank:
            wins += 0.5
        total += 1

    return wins / total


def equity_bucket(win_prob: float, n_buckets: int = NUM_BUCKETS) -> int:
    return min(int(win_prob * n_buckets), n_buckets - 1)


def compute_preflop_equity(k: int = 2000) -> dict:
    """Compute equity for all 169 canonical preflop hand categories."""
    table = {}
    for c0 in range(52):
        for c1 in range(c0 + 1, 52):
            key = preflop_key(c0, c1)
            if key in table:
                continue
            table[key] = mc_win_prob((c0, c1), (), k=k)
            print(f"  {key}: {table[key]:.3f}")
    return table


def load_preflop_equity() -> dict:
    with open(DATA_PATH, "rb") as f:
        return pickle.load(f)


if __name__ == "__main__":
    DATA_PATH.parent.mkdir(exist_ok=True)
    print("Computing preflop equity table...")
    table = compute_preflop_equity(k=2000)
    with open(DATA_PATH, "wb") as f:
        pickle.dump(table, f)
    print(f"Saved {len(table)} entries to {DATA_PATH}")
