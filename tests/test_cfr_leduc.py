"""Leduc Poker CFR sanity tests (non-interactive)."""
import random

import pytest

from src.algorithms.cfr import CFR
from src.algorithms.exploitability import compute_exploitability
from src.training.leduc_poker import LeducPokerRules


def test_strategies_are_valid_distributions_and_exploitability_decreases():
    random.seed(7)
    cfr = CFR(LeducPokerRules())

    cfr.train(2_000)
    early = compute_exploitability(cfr.info_sets, cfr.game)

    cfr.train(28_000)
    late = compute_exploitability(cfr.info_sets, cfr.game)

    for key, probs in cfr.get_strategy().items():
        assert sum(probs) == pytest.approx(1.0, abs=1e-6), key
        assert all(p >= -1e-12 for p in probs), key

    assert early >= -1e-9
    assert late >= -1e-9
    assert late < early, f"exploitability rose: {early:.4f} -> {late:.4f}"
    assert late < 0.25
