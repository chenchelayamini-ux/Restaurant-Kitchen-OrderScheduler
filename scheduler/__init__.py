"""
Restaurant Kitchen Order Scheduler
==================================

A small, dependency-free scheduling engine built on top of Python's
standard library (`heapq`, `dataclasses`, `math`).

Modules
-------
models      - the `Order` dataclass + validation helpers
strategies  - strategy definitions and the scoring / priority functions
queueing    - the heapq-backed priority queue (with lazy deletion)
engine      - the greedy job sequencer + decision-log (audit trail) builder
"""

from .models import Order, ValidationError  # noqa: F401

__all__ = ["Order", "ValidationError"]
__version__ = "1.0.0"
