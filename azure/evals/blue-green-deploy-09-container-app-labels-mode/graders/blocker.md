---
type: regex
target: last_message
match: contains
flags: i
---

blocker[^\n]{0,200}labels|labels[^\n]{0,200}blocker
