# Postmortem - Incident 001: Backend outage (planned drill)

**Date:** <fill in>   **Author:** <your name>   **Severity:** SEV-2 (drill)   **Status:** Resolved

## 1. Summary
During a planned reliability drill the backend container was stopped to test monitoring and alerting.
The BackendDown alert fired and the service was restored by restarting the container.

## 2. Impact
- The app API was unavailable from <start time> to <end time> (<X> minutes).
- Error budget consumed: <X> minutes of the 216 minutes monthly budget (<X>%).

## 3. Timeline (fill in real times from your screenshots)
| Time | Event |
|---|---|
| <hh:mm:00> | `docker stop medicine_backend` executed (incident starts) |
| <hh:mm:15> | Grafana "Backend status" panel turns DOWN |
| <hh:mm:45> | Prometheus alert BackendDown goes to PENDING |
| <hh:mm:~75> | Alert is FIRING and visible in Alertmanager |
| <hh:mm:00> | Engineer follows the runbook: `docker compose ps -a`, `docker start medicine_backend` |
| <hh:mm:00> | `/api/health` returns 200, alert RESOLVED (incident ends) |

## 4. Metrics
- **MTTD** (time to detect): <seconds from stop to alert firing>
- **MTTR** (time to recover): <seconds from alert to healthy>

## 5. Root cause
Intentional: the container was stopped manually to test the alerting pipeline.

## 6. What went well
- The alert fired automatically without anyone watching the dashboard.
- The runbook gave clear steps and recovery took less than <X> minutes.
- `restart: unless-stopped` does not restart a manually stopped container, which is the expected behavior.

## 7. What could be improved
- Alerts only appear in the Alertmanager UI. Add email or Slack notification so that on-call is paged.
- No trace data to follow one request through nginx, Flask and MySQL.
- Single EC2 server = single point of failure. A second server behind a load balancer would remove the outage.

## 8. Real incident from this project (bonus lesson)
During deployment the backend returned `503 database down`. Cause: a malformed `.env` line
(`DB_PASSWORD=...GRAFANA_PASSWORD=...`) changed the DB password. The new `/api/health` endpoint
caught it, the Ansible health wait failed, and the pipeline stopped. This is exactly the purpose of
health checks and CI/CD gates: the broken release was detected immediately.
An earlier problem: the server disk was 100% full, which is why the DiskAlmostFull alert was added.

## 9. Action items
| Action | Owner | Status |
|---|---|---|
| Add Slack/email receiver in Alertmanager | <name> | TODO |
| Use a validated `.env` template in the deployment | <name> | TODO |
| Upgrade EC2 to t3.small (more memory) | <name> | TODO |
