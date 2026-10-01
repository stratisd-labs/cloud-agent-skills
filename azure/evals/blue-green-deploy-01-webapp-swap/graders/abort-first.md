---
type: regex
target: last_message
match: contains
flags: i
---

[#]\s{0,3}abort[^\n]{0,200}\n[\s\S]{0,400}?--action\sreset[\s\S]{0,600}?[#]\s{0,3}cut-?over
