"""
PokerBot - A poker bot framework with CFR training support.
"""

__version__ = '0.1.0'

from . import training
from . import simulation
from . import algorithms
from . import evaluation
from . import utils

__all__ = ['training', 'simulation', 'algorithms', 'evaluation', 'utils']

