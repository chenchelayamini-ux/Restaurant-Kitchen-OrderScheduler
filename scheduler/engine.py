"""
Greedy job-sequencing engine + decision-log (audit trail) builder.

The kitchen is modelled as a **single non-preemptive machine**:

    * the clock starts at t = 0 and every ticket is available immediately
    * exactly one dish is cooked at a time
    * once a dish starts it runs to completion (no preemption)

Running one strategy is therefore a *greedy* construction: at each tick
pick the locally best remaining ticket, commit it to the timeline, advance
the clock by its prep time, repeat.  Greedy does not guarantee a global
optimum (1| |ΣwT is NP-hard), which is exactly why we (a) ship several
rules and (b) expose the full audit trail so a human can sanity-check the
machine.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .models import Order
from .queueing import KitchenPriorityQueue
from .strategies import (
    ATC_K,
    PRIORITY_FNS,
    STRATEGY_KEYS,
    Strategy,
    atc_breakdown,
    average_prep,
    get_strategy,
)

# Fixed penalty (in cost points) charged for every late ticket on top of its
# minute-weighted delay.  Keeps the optimiser from happily sacrificing one
# table to save thirty seconds elsewhere.
LATE_ORDER_PENALTY = 10.0

# Audit-trail safety switches - keep responses small for big inputs.
MAX_CANDIDATES_LOGGED = 6
FULL_SNAPSHOT_LIMIT = 30


# ---------------------------------------------------------------------- #
# result container
# ---------------------------------------------------------------------- #
@dataclass
class ScheduleResult:
    strategy: Strategy
    timeline: List[Dict[str, Any]]
    decision_log: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    order_count: int
    lookahead: float = ATC_K

    def to_dict(self) -> Dict[str, Any]:
        return {
            "strategy": {
                "key": self.strategy.key,
                "label": self.strategy.label,
                "blurb": self.strategy.blurb,
                "formula": self.strategy.formula,
                "dynamic": self.strategy.dynamic,
            },
            "lookahead_k": self.lookahead,
            "timeline": self.timeline,
            "decision_log": self.decision_log,
            "metrics": self.metrics,
            "order_count": self.order_count,
        }


# ---------------------------------------------------------------------- #
# metrics
# ---------------------------------------------------------------------- #
def _status_for(delay: int) -> str:
    if delay <= 0:
        return "on_time"
    return "slight_delay" if delay <= 5 else "delayed"


def compute_metrics(orders: List[Order]) -> Dict[str, Any]:
    """Aggregate the performance numbers for an already-sequenced list."""
    n = len(orders)
    if n == 0:
        return {
            "total_orders": 0,
            "total_delay": 0,
            "total_tardiness": 0,
            "max_tardiness": 0,
            "average_delay": 0.0,
            "on_time_count": 0,
            "delayed_count": 0,
            "on_time_percentage": 0.0,
            "makespan": 0,
            "utilisation": 0.0,
            "weighted_delay": 0.0,
            "late_penalty": 0.0,
            "total_cost": 0.0,
        }

    delays = [o.delay for o in orders]
    total_delay = sum(delays)
    on_time = sum(1 for d in delays if d <= 0)
    makespan = max(o.completion_time for o in orders)

    weighted = sum(o.delay * o.urgency for o in orders)
    late_penalty = LATE_ORDER_PENALTY * (n - on_time)

    return {
        "total_orders": n,
        "total_delay": total_delay,
        "total_tardiness": total_delay,          # tardiness == max(0, C - d); identical here
        "max_tardiness": max(delays),
        "average_delay": round(total_delay / n, 2),
        "on_time_count": on_time,
        "delayed_count": n - on_time,
        "on_time_percentage": round(100.0 * on_time / n, 1),
        "makespan": makespan,
        "utilisation": round(100.0 * sum(o.prep_time for o in orders) / makespan, 1) if makespan else 0.0,
        "weighted_delay": round(weighted, 2),
        "late_penalty": round(late_penalty, 2),
        "total_cost": round(weighted + late_penalty, 2),
    }


# ---------------------------------------------------------------------- #
# rationale generation - the "why" behind each greedy pick
# ---------------------------------------------------------------------- #
def _fmt(value: float) -> str:
    return f"{value:.3f}".rstrip("0").rstrip(".") or "0"


def build_rationale(
    strategy_key: str,
    chosen: Order,
    runner_up: Optional[Order],
    breakdown: Dict[str, float],
    now: int,
) -> str:
    cid, cname = chosen.id, chosen.name

    if strategy_key == "greedy_min_delay":
        ratio = breakdown["ratio"]
        factor = breakdown["deadline_factor"]
        slack = breakdown["slack"]
        risk = "already at risk (slack <= 0)" if breakdown["at_risk"] else f"{_fmt(slack)} min of slack"
        text = (
            f"Picked #{cid} {cname}: urgency ratio {chosen.urgency}/{chosen.prep_time} = {_fmt(ratio)} "
            f"x deadline factor {_fmt(factor)} = score {_fmt(breakdown['score'])}; {risk}."
        )
        if runner_up is not None:
            text += (
                f" Its urgency ratio outperformed its prep-time penalty versus runner-up "
                f"#{runner_up.id} {runner_up.name}."
            )
        return text

    if strategy_key == "edf":
        text = f"Picked #{cid} {cname}: earliest promised_time ({chosen.promised_time} min) of all remaining tickets."
        if runner_up is not None:
            gap = runner_up.promised_time - chosen.promised_time
            text += f" Deadline is {gap} min before runner-up #{runner_up.id} {runner_up.name} ({runner_up.promised_time} min)."
        return text

    if strategy_key == "huf":
        tied = runner_up is not None and runner_up.urgency == chosen.urgency
        text = f"Picked #{cid} {cname}: highest urgency ({chosen.urgency}/5)."
        if tied:
            text += f" Tied with #{runner_up.id}; broken by earlier promised_time ({chosen.promised_time} < {runner_up.promised_time})."
        elif runner_up is not None:
            text += f" Runner-up #{runner_up.id} {runner_up.name} is urgency {runner_up.urgency}."
        return text

    if strategy_key == "spt":
        text = f"Picked #{cid} {cname}: shortest prep_time ({chosen.prep_time} min) - clears the station fastest."
        if runner_up is not None:
            text += f" Runner-up #{runner_up.id} {runner_up.name} needs {runner_up.prep_time} min."
        return text

    # fifo
    text = f"Picked #{cid} {cname}: first in the input queue (position {chosen.position})."
    if runner_up is not None:
        text += f" Next in line: #{runner_up.id} {runner_up.name}."
    return text


# ---------------------------------------------------------------------- #
# the sequencer
# ---------------------------------------------------------------------- #
def schedule_orders(
    orders: List[Order],
    strategy_key: Optional[str] = None,
    k: Optional[float] = None,
) -> ScheduleResult:
    """
    Run the greedy job-sequencing loop.

    Returns a `ScheduleResult` carrying the timeline, the metrics and a
    step-by-step audit trail of every queue mutation and greedy choice.
    """
    strategy = get_strategy(strategy_key)
    key = strategy.key

    # deep-copy so we never mutate the caller's objects
    pool: List[Order] = [copy.deepcopy(o) for o in orders]
    for i, o in enumerate(pool, start=1):
        o.position = i

    avg_prep = average_prep(pool)
    lookahead: float = float(k) if k is not None else ATC_K
    priority_fn = PRIORITY_FNS[key]
    if key == "greedy_min_delay":
        _base_fn = priority_fn
        priority_fn = lambda o, now, avg, _f=_base_fn: _f(o, now, avg, lookahead)  # noqa: E731

    pq = KitchenPriorityQueue("kitchen")
    decision_log: List[Dict[str, Any]] = []
    timeline: List[Dict[str, Any]] = []
    scheduled: List[Order] = []

    now = 0
    step = 0
    remaining = list(pool)

    while remaining:
        step += 1

        # -- 1. (re)build the queue ----------------------------------------
        # Dynamic strategies recompute every score against the new clock
        # value, so we invalidate the whole heap and re-push - O(n log n)
        # per tick but trivially auditable.
        if strategy.dynamic or not pq.heap_size:
            gen_before = pq.generation
            pq.invalidate()
            pushed = []
            for o in remaining:
                pq.push(priority_fn(o, now, avg_prep), o)
                pushed.append(o.id)
            queue_event = {
                "type": "recompute" if strategy.dynamic else "build",
                "generation": pq.generation,
                "pushed": pushed if len(pool) <= FULL_SNAPSHOT_LIMIT else len(pushed),
                "note": (
                    f"Scores recomputed at t={now} for {len(pushed)} remaining ticket(s); "
                    f"heap invalidated (generation {gen_before} -> {pq.generation})."
                    if strategy.dynamic
                    else f"Heap built once from {len(pushed)} ticket(s); static rule "
                         f"({key.upper()}) means priorities never change."
                ),
            }
        else:
            queue_event = {
                "type": "reuse",
                "generation": pq.generation,
                "pushed": 0,
                "note": f"Static rule - heap reused unchanged at t={now}.",
            }

        # -- 2. snapshot the queue (before the pop) ------------------------
        ranked = pq.peek_sorted(limit=MAX_CANDIDATES_LOGGED)
        candidates: List[Dict[str, Any]] = []
        for rank, (_prio, o) in enumerate(ranked, start=1):
            bd = atc_breakdown(o, now, avg_prep, lookahead)
            entry = {
                "rank": rank,
                "id": o.id,
                "name": o.name,
                "urgency": o.urgency,
                "prep_time": o.prep_time,
                "promised_time": o.promised_time,
                "breakdown": bd,
                "priority_head": str(_prio[0]),
            }
            candidates.append(entry)

        # -- 3. pop the best -----------------------------------------------
        chosen = pq.pop()
        if chosen is None:  # pragma: no cover - defensive
            break

        runner_up: Optional[Order] = ranked[1][1] if len(ranked) > 1 else None
        breakdown = atc_breakdown(chosen, now, avg_prep, lookahead)

        # -- 4. commit to the timeline -------------------------------------
        start = now
        completion = start + chosen.prep_time
        delay = max(0, completion - chosen.promised_time)

        chosen.start_time = start
        chosen.completion_time = completion
        chosen.delay = delay
        chosen.on_time = delay <= 0

        slot = {
            "position": len(timeline) + 1,
            "id": chosen.id,
            "name": chosen.name,
            "urgency": chosen.urgency,
            "prep_time": chosen.prep_time,
            "promised_time": chosen.promised_time,
            "start_time": start,
            "completion_time": completion,
            "delay": delay,
            "on_time": delay <= 0,
            "status": _status_for(delay),
            "score": breakdown["score"] if key == "greedy_min_delay" else None,
            "note": (
                "served on time"
                if delay <= 0
                else f"{delay} min late (promised {chosen.promised_time}, finished {completion})"
            ),
        }
        timeline.append(slot)
        scheduled.append(chosen)
        remaining = [o for o in remaining if o.id != chosen.id]

        decision_log.append(
            {
                "step": step,
                "time_now": now,
                "queue_event": queue_event,
                "queue_size_before": len(remaining) + 1,
                "queue_size_after": len(remaining),
                "heap_entries_physical": pq.heap_size,
                "queue_state": (
                    [{"id": o.id, "name": o.name} for _p, o in pq.peek_sorted(limit=len(remaining) or 1)]
                    if len(pool) <= FULL_SNAPSHOT_LIMIT
                    else f"{len(remaining)} ticket(s) remaining (snapshot suppressed for large inputs)"
                ),
                "candidates": candidates,
                "chosen": {"id": chosen.id, "name": chosen.name},
                "runner_up": (
                    {"id": runner_up.id, "name": runner_up.name, "delta": None} if runner_up else None
                ),
                "rationale": build_rationale(key, chosen, runner_up, breakdown, now),
                "arithmetic": {
                    "start": start,
                    "prep_time": chosen.prep_time,
                    "completion": completion,
                    "promised_time": chosen.promised_time,
                    "delay": delay,
                    "formula": "completion = start + prep_time;  delay = max(0, completion - promised_time)",
                },
                "metrics_so_far": compute_metrics(scheduled),
            }
        )

        now = completion

    metrics = compute_metrics(scheduled)
    return ScheduleResult(
        strategy=strategy,
        lookahead=lookahead,
        timeline=timeline,
        decision_log=decision_log,
        metrics=metrics,
        order_count=len(pool),
    )


# ---------------------------------------------------------------------- #
# strategy comparison - "minimise cumulative cost"
# ---------------------------------------------------------------------- #
def compare_strategies(orders: List[Order]) -> Dict[str, Any]:
    """Run every strategy and rank them by cumulative (urgency-weighted) cost."""
    rows: List[Dict[str, Any]] = []
    for key in STRATEGY_KEYS:
        result = schedule_orders(orders, key)
        rows.append(
            {
                "key": key,
                "label": result.strategy.label,
                "total_delay": result.metrics["total_delay"],
                "max_tardiness": result.metrics["max_tardiness"],
                "on_time_percentage": result.metrics["on_time_percentage"],
                "delayed_count": result.metrics["delayed_count"],
                "makespan": result.metrics["makespan"],
                "total_cost": result.metrics["total_cost"],
            }
        )

    best_cost = min(r["total_cost"] for r in rows) if rows else 0.0
    for r in rows:
        r["is_best"] = r["total_cost"] == best_cost

    rows.sort(key=lambda r: (r["total_cost"], r["total_delay"], r["makespan"]))
    return {
        "rows": rows,
        "best": rows[0] if rows else None,
        "cost_formula": f"cost = SUM(delay x urgency) + {LATE_ORDER_PENALTY:g} x late_orders",
    }
