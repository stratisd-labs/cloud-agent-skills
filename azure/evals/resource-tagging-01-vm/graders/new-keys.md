---
type: regex
target: last_message
match: contains
flags: s
---

^(?=.{0,20000}businessunit)(?=.{0,20000}opsteam)(?=.{0,20000}managedby)(?=.{0,20000}vmuser)
