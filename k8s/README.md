# Kubernetes Demo (Minikube - runs on your laptop, not AWS)

This demonstrates Kubernetes concepts (Pods, Deployments, Services) from your
syllabus using Minikube - a single-node local Kubernetes cluster. This does
NOT touch your AWS EC2 deployment; it's a separate, local demo.

## 1. Install Minikube + kubectl (one-time)

**PowerShell:**
```powershell
winget install minikube
winget install Kubernetes.kubectl
```

Verify:
```powershell
minikube version
kubectl version --client
```

## 2. Start Minikube

```powershell
minikube start --driver=docker
```

This creates a local single-node Kubernetes cluster inside Docker Desktop.
Takes 1-3 minutes the first time (downloads the Kubernetes node image).

## 3. Build the backend image INSIDE Minikube's Docker environment

Minikube has its own separate Docker daemon. You need to build the image
there so Kubernetes can find it locally (not pull from a registry).

```powershell
minikube docker-env | Invoke-Expression
cd backend
docker build -t medicine-expiry-backend:latest .
cd ..
```

## 4. Apply the Kubernetes manifests

```powershell
kubectl apply -f k8s/mysql-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
```

## 5. Watch it come up

```powershell
kubectl get pods
```
**Expected:** You'll see `mysql-deployment-xxxxx` and TWO `backend-deployment-xxxxx`
pods (we set `replicas: 2`) move from `ContainerCreating` -> `Running`.

```powershell
kubectl get deployments
kubectl get services
```

## 6. Open the app

```powershell
minikube service backend-service
```
This opens your browser directly to the backend's `/api/health` via the
NodePort Kubernetes assigned - proving the app is actually being served
through Kubernetes, not directly through Docker.

## 7. Demonstrate self-healing (great thing to show faculty live)

```powershell
kubectl get pods
```
Copy one backend pod's name, then kill it:
```powershell
kubectl delete pod <paste-pod-name-here>
```
Immediately run:
```powershell
kubectl get pods
```
**You'll see Kubernetes automatically creates a new pod to replace the
deleted one** - this is the core "self-healing" concept: the Deployment
controller constantly ensures the actual state (running pods) matches
the desired state (`replicas: 2`) you declared in the YAML.

## 8. Clean up when done demoing

```powershell
kubectl delete -f k8s/backend-deployment.yaml
kubectl delete -f k8s/mysql-deployment.yaml
minikube stop
```

---

## What to say in viva

- **Pod** = smallest deployable unit, one running instance of your container
- **Deployment** = declares *how many* pods should run and *what image* to
  use; continuously reconciles actual state to match desired state
- **Service** = stable network endpoint that load-balances traffic across
  all matching pods, even as individual pods are replaced
- We used **2 replicas** for the backend specifically to demonstrate
  Kubernetes' self-healing and (conceptually) load distribution -
  something Docker Compose alone doesn't do automatically
- This runs on **Minikube locally** rather than AWS because a real K8s
  cluster needs more memory than our free-tier EC2 instance provides -
  a deliberate, explainable infrastructure sizing decision
