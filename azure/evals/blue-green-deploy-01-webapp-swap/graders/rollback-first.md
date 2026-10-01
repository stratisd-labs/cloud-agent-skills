---
type: regex
target: last_message
match: contains
flags: i
---

[#]\s{0,3}rollback[^\n]{0,200}\n[\s\S]{0,400}?slot\sswap[\s\S]{0,600}?#\s{0,3}cut-?over
