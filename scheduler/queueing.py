"""
The priority-queue engine.

A thin, well-instrumented wrapper around Python's `heapq` module.

Why a wrapper at all?
---------------------
`heapq` gives us O(log n) push / O(log n) pop on a plain list, but it has
no support for *re-prioritising* an existing entry - which is exactly what
the dynamic Greedy Min-Delay rule needs, because every ticket's score
changes as the clock advances.

The standard fix (and the one used here) is **lazy deletion with a
generation counter**:

    * each "tick" bumps `self.generation`
    * every pushed entry is stamped with the generation it was born in
    * `pop()` discards entries whose generation is stale

That is O(1) to invalidate the whole queue instead of rebuilding it, and
it keeps a truthful audit trail of every queue mutation.
"""

from __future__ import annotations

import heapq
import itertools
from typing import Any, Dict, List, Optional, Tuple

from .models import Order


class KitchenPriorityQueue:
    """Min-heap of `(priority_tuple, seq, generation, order)` entries."""

    def __init__(self, name: str = "kitchen") -> None:
        self.name = name
        self._heap: List[Tuple[tuple, int, int, Order]] = []
        self._counter = itertools.count()
        self.generation = 0
        self._live: Dict[Any, int] = {}  # order.id -> generation of its live entry

    # ------------------------------------------------------------------ #
    # mutation
    # ------------------------------------------------------------------ #
    def push(self, priority: tuple, order: Order) -> None:
        """Insert (or supersede) an order with the given priority tuple."""
        entry = (priority, next(self._counter), self.generation, order)
        heapq.heappush(self._heap, entry)
        self._live[order.id] = self.generation

    def invalidate(self) -> int:
        """Bump the generation: every current entry instantly becomes stale."""
        self.generation += 1
        self._live.clear()
        return self.generation

    def pop(self) -> Optional[Order]:
        """Pop the best *live* order, dropping stale entries on the way."""
        while self._heap:
            _priority, _seq, gen, order = heapq.heappop(self._heap)
            if gen == self.generation and self._live.get(order.id) == gen:
                del self._live[order.id]
                return order
        return None

    def peek_sorted(self, limit: int = 5) -> List[Tuple[tuple, Order]]:
        """Non-destructive view of the queue, best-first. Used for the audit log."""
        live = [e for e in self._heap if e[2] == self.generation and self._live.get(e[3].id) == e[2]]
        live.sort(key=lambda e: (e[0], e[1]))
        return [(e[0], e[3]) for e in live[:limit]]

    # ------------------------------------------------------------------ #
    # introspection
    # ------------------------------------------------------------------ #
    def __len__(self) -> int:
        return len(self._live)

    @property
    def heap_size(self) -> int:
        """Physical entries - including stale ones. Nice for teaching the pattern."""
        return len(self._heap)

    def clear(self) -> None:
        self._heap.clear()
        self._live.clear()
