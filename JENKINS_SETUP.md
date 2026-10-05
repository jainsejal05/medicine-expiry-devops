# Jenkins Demo (runs locally via Docker - separate from your main pipeline)

This is a standalone Jenkins Freestyle job to demonstrate the Build-Test-Deploy
loop and Jenkins+GitHub integration, as required by your syllabus. It runs
alongside (not instead of) your GitHub Actions CI/CD.

## 1. Run Jenkins in Docker (one-time)

**PowerShell:**
```powershell
docker volume create jenkins_home
docker run -d --name jenkins -p 8080:8080 -p 50000:50000 -v jenkins_home:/var/jenkins_home -v //var/run/docker.sock:/var/run/docker.sock jenkins/jenkins:lts
```

## 2. Get the initial admin password

```powershell
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```
Copy the long string it prints.

## 3. Open Jenkins in your browser

```
http://localhost:8080
```
Paste the password from Step 2. Click **"Install suggested plugins"** and
wait (a few minutes). Create an admin username/password when prompted.

## 4. Create a Freestyle Job

1. Click **"New Item"**
2. Name: `medicine-expiry-build`
3. Select **"Freestyle project"** → OK

## 5. Configure GitHub integration

1. Under **Source Code Management** → select **Git**
2. Repository URL: `https://github.com/jainsejal05/medicine-expiry-devops.git`
3. Branch: `*/main`

## 6. Add a Build Step

Under **Build Steps** → **Add build step** → **Execute shell**:
```bash
cd backend
pip install -r requirements.txt
python -m pytest test_app.py -v
docker build -t medicine-expiry-backend .
```

## 7. Add a Build Trigger (optional, for automatic builds)

Under **Build Triggers** → check **"Poll SCM"** → schedule: `H/5 * * * *`
(checks GitHub for new commits every 5 minutes and auto-builds if found)

## 8. Run it

Click **"Build Now"** (left sidebar) → click the build number that appears
→ **"Console Output"** → watch it live: pulling code, installing packages,
running your tests, building the Docker image.

## 9. What this demonstrates for viva

- **Build** stage: `pip install` + `docker build`
- **Test** stage: `pytest test_app.py`
- **Deploy** stage: (not wired up here deliberately - your real deploy
  happens via the separate GitHub Actions CD pipeline to AWS; explain
  in viva that Jenkins here demonstrates the *local* Build-Test loop,
  while GitHub Actions handles the *actual* Build-Test-Deploy to production)
- **Jenkins + GitHub integration**: show the Git repository configuration
  and (if using Poll SCM) a build that triggered automatically after a push

## 10. Stop Jenkins when done (frees up RAM)

```powershell
docker stop jenkins
```
To resume later: `docker start jenkins` (your job config is saved in the
`jenkins_home` volume).
