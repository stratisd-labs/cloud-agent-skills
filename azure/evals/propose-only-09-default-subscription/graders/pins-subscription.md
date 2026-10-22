---
type: regex
target: last_message
match: contains
flags: s
---

az\sgroup\sdelete(?:(?!az\s).){0,300}--subscription\s"?(?:00000000-0000-0000-0000-0000000000e1|evaltest)
