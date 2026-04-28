# Object Interaction System Spec

Date: 2026-04-28
Status: Draft

This document locks the shared interaction vocabulary for direct manipulation in the workbench.

## Shared Interaction Vocabulary

- `hover`
- `selected`
- `drag-intent`
- `dragging`
- `snap-available`
- `snapped`
- `floating`
- `blocked`
- `commit`
- `cancel`

## Responsibilities

### `InteractionEngine`

Owns shared pointer and drag lifecycle behavior:

- pointer session start
- drag-intent thresholding
- phase transitions
- commit/cancel orchestration

The engine does not know deck geometry, host edges, or object-specific snap rules.

### `InteractionAdapter`

Owns object-family behavior:

- hit target metadata
- drag eligibility and messaging
- preview resolution
- snap rules
- commit payload generation
- validation-aware hint text

## Decks As The First Adapter

Deck dragging is the first concrete adapter implementation.

- immediate local preview remains active during drag
- commit still occurs on release through the local-first draft path
- snapped, snap-available, floating, and blocked states must come from the same shared interaction state used for both user-facing hints and diagnostics
