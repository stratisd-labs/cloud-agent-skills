---
type: regex
target: last_message
match: contains
flags: is
---

group.{0,60}(?:neither|no|without|except).{0,30}opsteam.{0,40}webdomain|^(?=.{0,20000}opsteam[^\n]{0,80}(?:❌|never))(?=.{0,20000}webdomain[^\n]{0,80}(?:❌|never))
