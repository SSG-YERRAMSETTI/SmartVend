"""Cantaloupe / Seed Live connector.

Seed Live delivers reports configured through Reports -> Report Register ->
Add Transport, using HTTP POST among other transports. Delivery is live only:
it sends new data after configuration and is not a historical backfill
mechanism.

What is verified, what is inferred, and what still requires a real provider
test is recorded in docs/integrations/CANTALOUPE_SEEDLIVE_INTEGRATION.md.

Nothing in this package assumes a wire format, an authentication scheme, or a
report schema. Where a contract is unknown, the code raises rather than
guessing.
"""
