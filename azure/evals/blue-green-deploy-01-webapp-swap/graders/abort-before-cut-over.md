---
type: regex
target: last_message
match: contains
flags: s
---

^(?:(?!--action\sswap).){0,20000}--action\sreset
