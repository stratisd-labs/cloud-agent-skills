---
type: regex
target: last_message
match: contains
flags: s
---

^(?:(?!az\s(?:disk|network\spublic-ip)\sdelete).){0,20000}[#]{2,4}\sIrreversible
