# Setting Up Real Auto-Deploy (CD) to EC2

This makes every push to `main` automatically redeploy your live app on AWS.
One-time setup required.

## Why this is needed

GitHub Actions runs in GitHub's cloud, completely separate from your EC2
server. For it to deploy your code, it needs to SSH into EC2 itself. That
requires giving GitHub Actions your EC2 SSH key securely (as a GitHub
"Secret" - encrypted, never shown in logs) and making sure EC2 has its own
Git clone of your repo that can be pulled.

---

## Step 1: Make sure EC2 has a Git clone of your repo (one-time)

SSH into EC2:
```bash
ssh -i ~/medicine-keys/medicine-key ubuntu@65.1.56.149
```

Check if it's already a git repo:
```bash
cd ~/medicine-expiry-devops
git status
```

**If you see "not a git repository"** - your EC2 folder was set up via
`scp`/Ansible copy, not `git clone`. Fix it once:
```bash
cd ~
mv medicine-expiry-devops medicine-expiry-devops-backup
git clone https://github.com/jainsejal05/medicine-expiry-devops.git
cd medicine-expiry-devops
cp ../medicine-expiry-devops-backup/.env .
docker compose up -d --build
```

**If `git status` works fine** - you're already set, skip to Step 2.

## Step 2: Add GitHub Secrets (so Actions can SSH in)

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
→ **New repository secret**. Add these 3:

| Secret name | Value |
|---|---|
| `EC2_HOST` | `65.1.56.149` |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | *paste the full content of your `medicine-key` private key file* |

**To get the private key content** (run in WSL):
```bash
cat ~/medicine-keys/medicine-key
```
Copy everything, including the `-----BEGIN ... -----` and `-----END ... -----`
lines, and paste it as the `EC2_SSH_KEY` secret value exactly as-is.

## Step 3: Push the updated workflow file

The `.github/workflows/ci-cd.yml` file (already in your project) has the
deploy job wired up. Just commit and push it:

```powershell
git add .
git commit -m "Add CI/CD pipeline with auto-deploy to EC2"
git push
```

## Step 4: Watch it work

Go to your GitHub repo → **Actions** tab → you'll see the workflow run with
two jobs: `build-and-test` then `deploy`. Click into `deploy` to watch it
SSH into EC2 live and redeploy.

## Step 5: Verify

After the workflow finishes (green check), check:
```
http://65.1.56.149:5000/api/health
```
Should still respond normally - but now, **any future code change you
push to `main` will automatically appear here within a minute or two**,
with zero manual steps.

---

## ⚠️ Important safety note for tonight / before your demo

Once this is live, **every push to `main` immediately redeploys your live
demo app**. If you're pushing experimental changes close to demo time,
either:
- Work on a separate branch (`git checkout -b experiment`) and only merge
  to `main` when you're sure it works, **or**
- Temporarily disable the workflow: GitHub repo → Actions tab → select
  the workflow → **"..."** menu → **Disable workflow**
