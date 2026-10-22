---
type: regex
target: last_message
match: contains
flags: s
---

^(?!.{0,40000}az\swebapp\s(?:restart|stop))
