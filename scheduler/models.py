"""
Domain model for the kitchen scheduler.

Everything here is plain Python (dataclasses + enum) - no third-party
packages required, so `pip install flask` is the only dependency of the
whole backend.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


class ValidationError(ValueError):
    """Raised when incoming order JSON is malformed or out of range."""

    def __init__(self, errors: List[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


URGENCY_MIN = 1
URGENCY_MAX = 5


@dataclass(order=False)
class Order:
    """
    A single kitchen ticket waiting to be cooked.

    Fields
    ------
    id            stable identifier (int or str) used for tie-breaking
    name          human readable dish / ticket name
    prep_time     minutes of cooking work required (processing time p_j)
    urgency       1..5, 5 = VIP / about-to-walk-out customer (weight w_j)
    promised_time deadline in minutes measured from kitchen t=0 (due date d_j)
    """

    id: Any
    name: str
    prep_time: int
    urgency: int = 3
    promised_time: int = 0
    # filled in by the sequencer -------------------------------------------------
    start_time: int = field(default=None, repr=False, compare=False)  # type: ignore[assignment]
    completion_time: int = field(default=None, repr=False, compare=False)  # type: ignore[assignment]
    delay: int = field(default=0, repr=False, compare=False)
    on_time: bool = field(default=True, repr=False, compare=False)
    position: int = field(default=0, repr=False, compare=False)

    # ------------------------------------------------------------------ #
    # construction / validation
    # ------------------------------------------------------------------ #
    def __post_init__(self) -> None:
        self.validate()

    def validate(self) -> "Order":
        errors: List[str] = []

        if self.id is None or str(self.id).strip() == "":
            errors.append("Order 'id' is required.")
        if not str(self.name or "").strip():
            errors.append(f"Order {self.id!r}: 'name' is required.")

        try:
            self.prep_time = int(self.prep_time)
        except (TypeError, ValueError):
            errors.append(f"Order {self.id!r}: 'prep_time' must be a number.")
            self.prep_time = 0
        if self.prep_time <= 0:
            errors.append(f"Order {self.id!r}: 'prep_time' must be > 0.")

        try:
            self.urgency = int(self.urgency)
        except (TypeError, ValueError):
            errors.append(f"Order {self.id!r}: 'urgency' must be an integer 1-5.")
            self.urgency = 3
        if not (URGENCY_MIN <= self.urgency <= URGENCY_MAX):
            errors.append(
                f"Order {self.id!r}: 'urgency' must be between "
                f"{URGENCY_MIN} and {URGENCY_MAX} (got {self.urgency})."
            )

        try:
            self.promised_time = int(self.promised_time)
        except (TypeError, ValueError):
            errors.append(f"Order {self.id!r}: 'promised_time' must be a number.")
            self.promised_time = 0
        if self.promised_time < 0:
            errors.append(f"Order {self.id!r}: 'promised_time' cannot be negative.")

        if errors:
            raise ValidationError(errors)
        return self

    # ------------------------------------------------------------------ #
    # serialisation
    # ------------------------------------------------------------------ #
    def to_dict(self, include_schedule: bool = False) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "id": self.id,
            "name": self.name,
            "prep_time": self.prep_time,
            "urgency": self.urgency,
            "promised_time": self.promised_time,
        }
        if include_schedule:
            data.update(
                {
                    "start_time": self.start_time,
                    "completion_time": self.completion_time,
                    "delay": self.delay,
                    "on_time": self.on_time,
                    "position": self.position,
                }
            )
        return data

    @classmethod
    def from_dict(cls, raw: Dict[str, Any]) -> "Order":
        if not isinstance(raw, dict):
            raise ValidationError([f"Each order must be a JSON object, got {type(raw).__name__}."])
        return cls(
            id=raw.get("id"),
            name=str(raw.get("name", "")).strip(),
            prep_time=raw.get("prep_time", 0),
            urgency=raw.get("urgency", 3),
            promised_time=raw.get("promised_time", 0),
        )

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"#{self.id} {self.name}"


# ---------------------------------------------------------------------- #
# helpers
# ---------------------------------------------------------------------- #
def parse_orders(payload: Any) -> List[Order]:
    """Validate a raw JSON list into a list of `Order` objects."""
    if not isinstance(payload, list):
        raise ValidationError(["'orders' must be a JSON array."])
    if not payload:
        raise ValidationError(["No orders supplied - add at least one order."])
    if len(payload) > 200:
        raise ValidationError(["Too many orders (max 200)."])

    orders: List[Order] = []
    errors: List[str] = []
    seen = set()
    for index, raw in enumerate(payload):
        try:
            order = Order.from_dict(raw)
        except ValidationError as exc:
            errors.extend(f"(index {index}) {e}" for e in exc.errors)
            continue
        if order.id in seen:
            errors.append(f"Duplicate order id {order.id!r}.")
            continue
        seen.add(order.id)
        orders.append(order)

    if errors:
        raise ValidationError(errors)
    return orders


# ---------------------------------------------------------------------- #
# built-in demo tickets
# ---------------------------------------------------------------------- #
SAMPLE_ORDERS: List[Dict[str, Any]] = [
    {"id": 1, "name": "Margherita Pizza",     "prep_time": 12, "urgency": 3, "promised_time": 40,"Price":299},
    {"id": 2, "name": "Butter Chicken",       "prep_time": 18, "urgency": 5, "promised_time": 53,"Price":399},
    {"id": 3, "name": "Garden Salad",         "prep_time":  5, "urgency": 1, "promised_time": 21,"Price":199},
    {"id": 4, "name": "Paneer Tikka",         "prep_time": 14, "urgency": 4, "promised_time": 38,"Price":149},
    {"id": 5, "name": "Garlic Bread",         "prep_time":  4, "urgency": 2, "promised_time": 11,"Price":99},
    {"id": 6, "name": "Spl Hyderabadi Biryani",   "prep_time": 22, "urgency": 5, "promised_time": 43,"Price":599},
    {"id": 7, "name": "Masala Dosa",          "prep_time":  9, "urgency": 3, "promised_time": 23,"Price":69},
    {"id": 8, "name": "Mango Lassi",          "prep_time":  3, "urgency": 1, "promised_time":  7,"Price":99},
    {"id": 9, "name": "Chicken 65", "prep_time": 15, "urgency": 4, "promised_time": 35, "price": 240},
    {"id": 10, "name": "Veg Fried Rice", "prep_time": 10, "urgency": 2, "promised_time": 25, "price": 160},
    {"id": 12, "name": "Paneer Butter Masala", "prep_time": 16, "urgency": 4, "promised_time": 42, "price": 230},
    {"id": 13, "name": "Veg Manchurian", "prep_time": 11, "urgency": 2, "promised_time": 28, "price": 170},
    {"id": 14, "name": "Chicken Biryani", "prep_time": 20, "urgency": 5, "promised_time": 45, "price": 320},
    {"id": 15, "name": "Cheese Burger", "prep_time": 8, "urgency": 3, "promised_time": 22, "price": 180},
    {"id": 16, "name": "French Fries", "prep_time": 6, "urgency": 1, "promised_time": 15, "price": 100},
    {"id": 17, "name": "Chicken Tikka", "prep_time": 17, "urgency": 4, "promised_time": 40, "price": 260},
    {"id": 18, "name": "Pav Bhaji", "prep_time": 9, "urgency": 2, "promised_time": 24, "price": 140},
    {"id": 19, "name": "Veg Pizza", "prep_time": 13, "urgency": 3, "promised_time": 32, "price": 220},
    {"id": 20, "name": "Chocolate Brownie", "prep_time": 7, "urgency": 1, "promised_time": 18, "price": 130},
]

