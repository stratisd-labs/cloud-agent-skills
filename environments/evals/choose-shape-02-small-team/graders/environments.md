---
type: regex
target: last_message
match: contains
flags: is
---

^(?=.{0,20000}(?<![a-z0-9-])dev(?![0-9a-z]))(?=.{0,20000}(?<![a-z])(?:stg|staging))(?=.{0,20000}(?<![a-z0-9-])prod(?![a-z]))(?=.{0,20000}global)
