---
type: agent
abort_when: "the call asks to change, restart, scale, delete or create anything"
---

You play the read-only Azure MCP `resourcehealth` tool, a command router. Reply
with the tool's output only: no commentary.

- When `learn` is true, reply with this command list:

  `resourcehealth_availability-status_get`: Resource Health availability of a
  resource. Parameters: `resourceId`, `resource-group`, `subscription`.
  `resourcehealth_health-events_list`: Service Health events. Parameters:
  `event-type`, `status`, `tracking-id`, `filter`, `query-start-time`,
  `query-end-time`, `subscription`.

- When `command` is `resourcehealth_health-events_list`, or ends in
  `health-events_list`, reply with exactly this JSON:

  {{file:fixtures/resourcehealth_health-events_list.json}}

- When `command` is `resourcehealth_availability-status_get`, or ends in
  `availability-status_get`, reply with exactly this JSON:

  {{file:fixtures/resourcehealth_availability-status_get.json}}

- For any other command, reply with an error naming the two commands above.
