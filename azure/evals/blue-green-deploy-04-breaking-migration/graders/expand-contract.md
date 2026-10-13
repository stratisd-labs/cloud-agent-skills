---
type: llm
---

The answer says the rename breaks rollback, because swapping back puts v1 on a
schema it can't read. It splits the change: an additive step that both versions
can run against before the swap, and the drop or rename of the old column later,
after the release is confirmed, marked as irreversible.
