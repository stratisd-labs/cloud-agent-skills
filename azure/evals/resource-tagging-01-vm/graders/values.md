---
type: regex
target: last_message
match: contains
flags: is
---

^(?=.{0,20000}environment\W{0,40}prod)(?=.{0,20000}app\W{0,40}orderintake)(?=.{0,20000}domain\W{0,40}api)(?=.{0,20000}region\W{0,40}weu)(?=.{0,20000}managedby\W{0,40}example-org/orderintake-infra)(?=.{0,20000}vmuser\W{0,40}azureuser)
