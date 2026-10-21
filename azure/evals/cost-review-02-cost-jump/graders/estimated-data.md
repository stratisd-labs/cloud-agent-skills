---
type: regex
target: last_message
match: contains
flags: is
weight: 0.5
---

(?:open|today|current\smonth|this\smonth).{0,80}(?:estimated?|estimates|incomplete|not\s(?:yet\s)?final)
