---
type: regex
target: last_message
match: contains
flags: i
---

preview[^\n]{0,250}(queue|trigger)|(queue|trigger)[^\n]{0,250}preview
