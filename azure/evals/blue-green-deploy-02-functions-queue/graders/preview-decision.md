---
type: regex
target: last_message
match: contains
flags: i
---

direct\sswap[^\n]{0,150}(timer|warm-?up)|(timer|single)[^\n]{0,150}direct\sswap|(deadline|time-?box)[^\n]{0,120}preview|preview[^\n]{0,120}(deadline|time-?box)
