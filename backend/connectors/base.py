"""Abstract base class for database connectors."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ColumnStat:
    column_name: str
    null_frac: float
    avg_width: int
    n_distinct: float
    most_common_vals: list[Any] = field(default_factory=list)
    most_common_freqs: list[float] = field(default_factory=list)


@dataclass
class IndexInfo:
    index_name: str
    table_name: str
    columns: list[str]
    is_unique: bool
    index_type: str  # btree, hash, gin, gist …
    definition: str


@dataclass
class TableSchema:
    table_name: str
    columns: list[dict]   # {name, type, nullable, default}
    row_count: int
    indexes: list[IndexInfo]
    column_stats: list[ColumnStat]


@dataclass
class ExplainResult:
    raw_plan: str          # full text output of EXPLAIN ANALYZE
    planning_time_ms: float | None
    execution_time_ms: float | None


class BaseConnector(ABC):
    """Read-only database connector interface."""

    @abstractmethod
    def test_connection(self) -> bool:
        """Return True if the connection is alive."""

    @abstractmethod
    def explain_analyze(self, sql: str, timeout_ms: int) -> ExplainResult:
        """Run EXPLAIN ANALYZE on the given SQL and return the plan."""

    @abstractmethod
    def get_table_schema(self, table_name: str, schema: str | None = None) -> TableSchema:
        """Return full schema + stats for a single table."""

    @abstractmethod
    def get_existing_indexes(self, table_names: list[str]) -> list[IndexInfo]:
        """Return all indexes that cover the given tables."""

    @abstractmethod
    def close(self) -> None:
        """Release the underlying connection."""
