"""Compare two SQL queries by executing both and diffing result sets."""

import logging

from connectors.base import BaseConnector
from api.models.schemas import CompareResult, RowDiff

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_MS = 30_000


def compare_queries(
    connector: BaseConnector,
    original_sql: str,
    rewritten_sql: str,
    row_limit: int = 100,
    timeout_ms: int = DEFAULT_TIMEOUT_MS,
) -> CompareResult:
    """Execute both queries with LIMIT and compare their result sets row-by-row."""

    original_rows: list[tuple] = []
    rewritten_rows: list[tuple] = []
    original_error: str | None = None
    rewritten_error: str | None = None

    try:
        original_rows = connector.execute_limited(original_sql, row_limit, timeout_ms)
    except Exception as exc:
        original_error = str(exc).strip()

    try:
        rewritten_rows = connector.execute_limited(rewritten_sql, row_limit, timeout_ms)
    except Exception as exc:
        rewritten_error = str(exc).strip()

    # If either query failed, return early with the errors
    if original_error or rewritten_error:
        return CompareResult(
            results_match=False,
            rows_compared=0,
            original_row_count=len(original_rows),
            rewritten_row_count=len(rewritten_rows),
            original_error=original_error,
            rewritten_error=rewritten_error,
        )

    # Sort both result sets so row order doesn't affect comparison
    def _sort_key(row: tuple) -> tuple:
        return tuple((str(v) if v is not None else "") for v in row)

    original_rows.sort(key=_sort_key)
    rewritten_rows.sort(key=_sort_key)

    original_count = len(original_rows)
    rewritten_count = len(rewritten_rows)
    rows_to_compare = min(original_count, rewritten_count)

    # Row-by-row comparison
    first_diff: RowDiff | None = None
    for i in range(rows_to_compare):
        if original_rows[i] != rewritten_rows[i]:
            first_diff = RowDiff(
                row_number=i + 1,
                original_row=list(original_rows[i]),
                rewritten_row=list(rewritten_rows[i]),
            )
            break

    # If row counts differ, that's also a mismatch
    if first_diff is None and original_count != rewritten_count:
        first_diff = RowDiff(
            row_number=rows_to_compare + 1,
            original_row=list(original_rows[rows_to_compare]) if original_count > rows_to_compare else [],
            rewritten_row=list(rewritten_rows[rows_to_compare]) if rewritten_count > rows_to_compare else [],
        )

    results_match = first_diff is None

    return CompareResult(
        results_match=results_match,
        rows_compared=rows_to_compare,
        original_row_count=original_count,
        rewritten_row_count=rewritten_count,
        first_diff=first_diff,
    )
