from typing import Annotated

from fastapi import Path

# Every id in this API is a Postgres uuid, and Postgres answers a malformed
# one with a driver error rather than an empty result -- which surfaced as
# an unhandled 500 on every dashboard route given something like
# /agents/foo. Declaring the shape on the path parameter makes FastAPI
# refuse it with a 422 before the route, and the database, are reached.
#
# The public chat route validates its ids by hand instead, because it has
# to answer 404 rather than 422 there (see public_chat._not_found).
UUID_PATTERN = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"

UUIDPath = Annotated[str, Path(pattern=UUID_PATTERN)]
