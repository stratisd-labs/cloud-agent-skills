---
type: regex
target: last_message
match: contains
flags: im
---

^(#{2,4}\s{0,3}|[*]{2}\s{0,3}(\d{1,2}\.\s{0,3})?)(checkpoint|stop|go/no-go)
