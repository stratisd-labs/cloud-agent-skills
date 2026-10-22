---
type: regex
target: last_message
match: contains
flags: is
---

(?:service|resource)\shealth.{0,8000}(?:slotsswap|slot\sswap|swapped)
