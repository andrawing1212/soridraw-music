#!/usr/bin/env python3
"""RETIRED SAFETY STUB.

This migration used an owner-wide Music Note/Library cache rebuild. SORIDRAW now
forbids any automatic whole-user song read on new devices, cleared caches, schema
changes, refreshes, or normal navigation. Cold starts must use bounded pages plus
cache/delta synchronization.
"""

raise SystemExit(
    "RETIRED: apply-preview-cache-parity-v1.py is permanently blocked because it can trigger unbounded user-song reads."
)
