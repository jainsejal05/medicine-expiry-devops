# Service Level Objectives (SLO) - Medicine Expiry Tracker

## 1. Service description
A web application (nginx frontend, Flask backend, MySQL database) that helps users track medicine expiry dates.
It is deployed on AWS EC2 through a Jenkins CI/CD pipeline and monitored with Prometheus, Grafana and Alertmanager.

## 2. Key terms
| Term | Meaning |
|---|---|
| **SLI** (Service Level Indicator) | A measurement of how the service behaves (e.g. % of successful requests). |
| **SLO** (Service Level Objective) | The target we set for an SLI (e.g. 99.5%). |
| **SLA** (Service Level Agreement) | A contract with consequences if the target is missed. We have SLOs only (no SLA) because this is a project. |
| **Error budget** | The amount of failure the SLO allows: 100% - SLO. |
| **Burn rate** | How fast the error budget is being used. 1x = budget lasts exactly the whole window. |

## 3. User journeys we care about
1. Open the app and log in.
2. View, add, edit and delete medicines.
3. See the expiry status (safe, expiring soon, urgent, expired).

All of them depend on the backend API, so we measure the API.

## 4. SLIs and SLOs
| # | SLI (what we measure) | PromQL (Prometheus query) | SLO target | Window |
|---|---|---|---|---|
| 1 | **Availability:** share of requests that do NOT return 5xx | `1 - (sum(rate(flask_http_request_total{status=~"5.."}[5m])) / sum(rate(flask_http_request_total[5m])))` | **99.5%** | 30 days |
| 2 | **Latency:** 95th percentile response time | `histogram_quantile(0.95, sum(rate(flask_http_request_duration_seconds_bucket[5m])) by (le))` | **< 500 ms** | measured every 5 min, met 99% of the time |
| 3 | **Reachability:** backend is up and scrapeable | `up{job="backend"}` | **99.5%** | 30 days |
| 4 | **Saturation:** server disk usage | `100 - (node_filesystem_avail_bytes / node_filesystem_size_bytes * 100)` | **< 85%** | always |

## 5. Error budget calculation
- SLO = 99.5% availability over 30 days.
- Error budget = 100% - 99.5% = **0.5%**.
- Time in 30 days = 30 x 24 x 60 = 43,200 minutes.
- Allowed downtime = 43,200 x 0.005 = **216 minutes (about 3.6 hours) per month**.

For comparison, a 99.9% SLO would allow only 43.2 minutes per month.

### What we do with the budget
| Budget remaining | Action |
|---|---|
| More than 50% | Normal development. Deploy new features freely. |
| 10% to 50% | Be careful: smaller releases, extra testing. |
| Less than 10% or exhausted | **Feature freeze.** Only reliability fixes until the budget recovers. |

## 6. Alerts linked to the SLOs
All rules are in `monitoring/prometheus/alert_rules.yml`.

| Alert | Condition | Severity | Linked SLO |
|---|---|---|---|
| BackendDown | backend not scrapeable for 30 s | critical | Reachability |
| HighErrorRate | more than 1% 5xx for 2 min | warning | Availability (budget burning at 2x) |
| ErrorBudgetFastBurn | more than 7.2% 5xx for 5 min (burn rate 14.4x) | critical | Availability |
| HighLatencyP95 | p95 above 0.5 s for 2 min | warning | Latency |
| DiskAlmostFull | disk above 85% for 5 min | warning | Saturation |

Why 7.2%? A burn rate of 14.4 means 2% of the monthly budget is used in one hour (14.4 x 0.5% = 7.2%).
This is the standard "fast burn" alert from the Google SRE Workbook.

## 7. Four golden signals mapping
| Golden signal | Where we measure it |
|---|---|
| Latency | Grafana "Response time percentiles" panel, HighLatencyP95 alert |
| Traffic | Grafana "Requests per second" panels |
| Errors | Grafana "5xx / 4xx errors per second" panels, HighErrorRate alert |
| Saturation | Grafana CPU / memory / disk panels (node-exporter, cAdvisor), DiskAlmostFull alert |

## 8. Observability pillars
| Pillar | Implementation |
|---|---|
| Metrics | Prometheus + prometheus-flask-exporter (`/metrics`), node-exporter, cAdvisor |
| Logs | Structured JSON logs on stdout (`docker compose logs backend`), one line per request with status and duration |
| Traces | Not implemented. A future step would be OpenTelemetry + Jaeger to trace a request from nginx to Flask to MySQL. |

## 9. Runbook (what to do when an alert fires)
**BackendDown**
1. `ssh ubuntu@<elastic-ip>` then `docker compose ps -a`.
2. If `medicine_backend` is stopped: `docker compose up -d backend`.
3. Check `docker compose logs backend --tail 50` for the cause.
4. Check `curl localhost:5000/api/health`. `database: down` means check MySQL and the `.env` password.

**HighErrorRate / ErrorBudgetFastBurn**
1. Open the Grafana error panels to see which time the errors started.
2. Check whether a deployment happened just before (Jenkins build history).
3. If yes, roll back with `git revert` and push (Jenkins redeploys the previous version).

**DiskAlmostFull**
1. `docker system prune -af` and `docker builder prune -af`.
2. If still above 85%, enlarge the EBS volume.

## 10. Toil reduction and reliability automation
- Deployments are fully automated (Jenkins + Ansible), so there are no manual steps that can be forgotten.
- `restart: unless-stopped` on every container restarts services after a crash or server reboot.
- `/api/health` checks the database, so a broken DB connection is detected during deployment (the pipeline fails instead of releasing a broken version).
- Health check in the pipeline (Ansible wait + Smoke Test) stops bad releases.
