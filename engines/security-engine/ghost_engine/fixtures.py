from .models import Scenario

DEMO = Scenario.model_validate({
  "name": "Synthetic enterprise — public demo",
  "assets": [
    {"id":"internet","name":"External Entry","kind":"network","criticality":1},
    {"id":"laptop","name":"Employee Laptop","kind":"workstation","criticality":2},
    {"id":"identity","name":"Service Identity","kind":"identity","criticality":4},
    {"id":"gateway","name":"Application Gateway","kind":"server","criticality":3},
    {"id":"vault","name":"Sensitive Data Vault","kind":"database","criticality":5},
    {"id":"backup","name":"Backup Server","kind":"server","criticality":4}
  ],
  "relationships": [
    {"source":"internet","target":"laptop","kind":"connects"},
    {"source":"laptop","target":"identity","kind":"authenticates"},
    {"source":"identity","target":"gateway","kind":"administers"},
    {"source":"gateway","target":"vault","kind":"connects","requires":["identity"]},
    {"source":"gateway","target":"backup","kind":"connects"}
  ],
  "initial_access":["internet"],
  "target":"vault"
})
