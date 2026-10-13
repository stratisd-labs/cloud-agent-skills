---
type: regex
target: last_message
match: contains
flags: i
---

AzureWebJobs\.[^.\s`]{1,80}\.Disabled|(queue|storage)[^\n]{0,150}(sticky|slot\ssetting)|(sticky|slot\ssetting)[^\n]{0,150}(queue|storage)
