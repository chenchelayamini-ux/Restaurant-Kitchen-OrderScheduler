"""
Scheduling strategies.

Each strategy exposes a **priority function** `priority(order, ctx) -> tuple`.

The scheduler always pops the *smallest* tuple from the heap (Python's
`heapq` is a min-heap), so every priority tuple is authored "smaller is
better".  Ties are always broken deterministically by
`(promised_time, prep_time, id)` so the same input always produces the
exact same output - which matters for an auditable kitchen system.

The star of the show is `greedy_min_delay`, an **Apparent Tardiness Cost
(ATC)** dispatching rule: a weighted multi-criteria score that fuses
urgency, prep-time penalty and deadline slack into one number.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Dict, List, Sequence

from .models import Order

# Look-ahead scaling constant for the ATC exponential decay.
#  - small K  -> aggressive, almost pure "urgency / prep_time" (SPT-ish)
#  - large K  -> gentle decay, behaves closer to Earliest-Deadline-First
ATC_K = 1.5


@dataclass(frozen=True)
class Strategy:
    key: str
    label: str
    blurb: str
    formula: str
    dynamic: bool  # True => priority is recomputed at every tick


# ---------------------------------------------------------------------- #
# scoring
# ---------------------------------------------------------------------- #
def atc_breakdown(order: Order, now: float, avg_prep: float, k: float = ATC_K) -> Dict[str, float]:
    """
    Return the full arithmetic behind one order's greedy score so the
    frontend can show *why* the number came out the way it did.

        score = (urgency / prep_time) * exp( -max(0, slack) / (K * avg_prep) )
        slack = promised_time - prep_time - now

    Interpretation
    --------------
    * ``urgency / prep_time``  -> "urgency ratio" vs "prep-time penalty".
      A 5-star ticket that takes 5 minutes beats a 5-star ticket that
      takes 30 minutes, because it unblocks the queue sooner.
    * the exponential term     -> deadline discount.  Tickets with lots of
      slack are exponentially deprioritised; once slack <= 0 (the ticket
      is already at risk) the term saturates at 1.0 and only the raw
      urgency ratio matters.
    """
    slack = order.promised_time - order.prep_time - now
    free_slack = max(0.0, slack)
    denominator = k * avg_prep if avg_prep > 0 else 1.0
    ratio = order.urgency / order.prep_time if order.prep_time else float(order.urgency)
    deadline_factor = math.exp(-free_slack / denominator) if denominator else 1.0
    score = ratio * deadline_factor

    return {
        "urgency": float(order.urgency),
        "prep_time": float(order.prep_time),
        "promised_time": float(order.promised_time),
        "now": float(now),
        "slack": float(slack),
        "free_slack": float(free_slack),
        "ratio": round(ratio, 6),
        "avg_prep_time": round(avg_prep, 3),
        "k": float(k),
        "deadline_factor": round(deadline_factor, 6),
        "score": round(score, 6),
        "at_risk": bool(slack <= 0),
    }


def _tie_breaker(order: Order) -> tuple:
    """Deterministic, total ordering used to break every tie."""
    return (order.promised_time, order.prep_time, str(order.id))


def priority_edf(order: Order, now: float, avg_prep: float) -> tuple:
    """Earliest Deadline First - minimise the maximum lateness."""
    return (order.promised_time, -order.urgency, order.prep_time, str(order.id))


def priority_huf(order: Order, now: float, avg_prep: float) -> tuple:
    """Highest Urgency First - serve the angriest table, then tightest deadline."""
    return (-order.urgency, order.promised_time, order.prep_time, str(order.id))


def priority_spt(order: Order, now: float, avg_prep: float) -> tuple:
    """Shortest Prep Time First - maximises throughput, ignores deadlines."""
    return (order.prep_time, -order.urgency, order.promised_time, str(order.id))


def priority_fifo(order: Order, now: float, avg_prep: float) -> tuple:
    """First In First Out - the naive baseline (input order)."""
    return (order.position, order.promised_time, str(order.id))


def priority_greedy(order: Order, now: float, avg_prep: float, k: float = ATC_K) -> tuple:
    """Greedy Min-Delay (ATC) - dynamic weighted composite score."""
    score = atc_breakdown(order, now, avg_prep, k)["score"]
    # negate because heapq pops the smallest tuple first
    return (-score, *_tie_breaker(order))


PRIORITY_FNS: Dict[str, Callable[..., tuple]] = {
    "edf": priority_edf,
    "huf": priority_huf,
    "spt": priority_spt,
    "fifo": priority_fifo,
    "greedy_min_delay": priority_greedy,
}


STRATEGIES: List[Strategy] = [
    Strategy(
        key="greedy_min_delay",
        label="Greedy Min-Delay Heuristic (ATC)",
        blurb=(
            "Dynamic composite score recombined at every tick. Balances urgency ratio "
            "against the prep-time penalty and discounts tickets that still have slack. "
            "Usually the best overall delay/cost trade-off."
        ),
        formula="score = (urgency / prep_time) x exp( -max(0, promised - prep - now) / (K x avg_prep) )",
        dynamic=True,
    ),
    Strategy(
        key="edf",
        label="Earliest Deadline First (EDF)",
        blurb="Classic real-time rule: always cook the ticket with the soonest promise. Optimal for minimising maximum lateness on a single station.",
        formula="priority = promised_time  (ascending)",
        dynamic=False,
    ),
    Strategy(
        key="huf",
        label="Highest Urgency First",
        blurb="VIP-first. Ignores how long each dish takes, so short urgent tickets do not get fast-tracked.",
        formula="priority = -urgency  (then earliest deadline)",
        dynamic=False,
    ),
    Strategy(
        key="spt",
        label="Shortest Prep Time First",
        blurb="Throughput maximiser: clears the queue fastest by doing quick dishes first. Can starve big-ticket items.",
        formula="priority = prep_time  (ascending)",
        dynamic=False,
    ),
    Strategy(
        key="fifo",
        label="First In, First Out (baseline)",
        blurb="Cook in arrival order - the 'do nothing smart' control case every other strategy should beat.",
        formula="priority = input position  (ascending)",
        dynamic=False,
    ),
]

STRATEGY_KEYS: List[str] = [s.key for s in STRATEGIES]
DEFAULT_STRATEGY = "greedy_min_delay"


def get_strategy(key: str | None) -> Strategy:
    """Resolve a strategy key, falling back to the default."""
    for s in STRATEGIES:
        if s.key == key:
            return s
    for s in STRATEGIES:
        if s.key == DEFAULT_STRATEGY:
            return s
    return STRATEGIES[0]  # pragma: no cover


def average_prep(orders: Sequence[Order]) -> float:
    if not orders:
        return 0.0
    return sum(o.prep_time for o in orders) / len(orders)
