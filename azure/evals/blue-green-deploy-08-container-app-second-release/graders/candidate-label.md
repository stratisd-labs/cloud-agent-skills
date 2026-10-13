---
type: regex
target: last_message
match: contains
flags: is
---

label\sadd.{0,200}?--label\sblue|--label\sblue.{0,200}?label\sadd
