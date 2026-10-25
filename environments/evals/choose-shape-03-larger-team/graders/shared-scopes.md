---
type: regex
target: last_message
match: contains
flags: is
---

^(?=.{0,20000}global)(?=.{0,20000}(?<![a-z])(?:stg|staging))
