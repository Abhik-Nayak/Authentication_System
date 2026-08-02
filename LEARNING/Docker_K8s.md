# Docker & Kubernetes — Quick Reference

> **📌 Note (80/20 Rule):** This guide covers the **20% of Docker & Kubernetes commands
> you'll use 80% of the time**. It's meant as a practical cheat sheet for day-to-day work,
> not exhaustive documentation. For deep dives, always check the official docs:
> [Docker](https://docs.docker.com/) · [Kubernetes](https://kubernetes.io/docs/) · [kubectl](https://kubernetes.io/docs/reference/kubectl/) · [Kind](https://kind.sigs.k8s.io/)

---

## Table of Contents
1. [Docker Essentials](#1-docker-essentials)
2. [Writing Dockerfiles (Single vs Multi-Stage)](#2-writing-dockerfiles-single-vs-multi-stage)
3. [Docker Compose](#3-docker-compose)
4. [Kubernetes Architecture](#4-kubernetes-architecture)
5. [kubectl Essentials](#5-kubectl-essentials)
6. [Kind (Kubernetes in Docker)](#6-kind-kubernetes-in-docker)
7. [Common Workflows / Use Cases](#7-common-workflows--use-cases)
8. [Troubleshooting Cheat Sheet](#8-troubleshooting-cheat-sheet)

---

## 1. Docker Essentials

### Images
| Command | Use Case |
|---------|----------|
| `docker build -t myapp:1.0 .` | Build an image from a `Dockerfile` in current dir |
| `docker images` | List local images |
| `docker pull node:20-alpine` | Download an image from a registry |
| `docker push myrepo/myapp:1.0` | Push image to a registry |
| `docker tag myapp:1.0 myrepo/myapp:1.0` | Re-tag before pushing |
| `docker rmi myapp:1.0` | Remove an image |

### Containers
| Command | Use Case |
|---------|----------|
| `docker run -d -p 8080:80 --name web nginx` | Run detached, map host:container port, name it |
| `docker run -it ubuntu bash` | Run interactively with a shell |
| `docker ps` / `docker ps -a` | List running / all containers |
| `docker logs -f web` | Follow container logs (live) |
| `docker exec -it web sh` | Get a shell inside a running container |
| `docker stop web` / `docker start web` | Stop / start a container |
| `docker rm web` | Remove a container (must be stopped) |
| `docker cp web:/app/log.txt .` | Copy a file out of a container |

### Cleanup (⚠️ frees disk space)
| Command | Use Case |
|---------|----------|
| `docker system prune -a` | Remove all unused images, containers, networks |
| `docker volume prune` | Remove unused volumes |
| `docker stop $(docker ps -q)` | Stop **all** running containers |

### Volumes & Networks
| Command | Use Case |
|---------|----------|
| `docker volume create mydata` | Create a named volume for persistence |
| `docker run -v mydata:/data ...` | Mount a volume into a container |
| `docker run -v $(pwd):/app ...` | Bind-mount host dir (great for local dev) |
| `docker network create mynet` | Create a user-defined bridge network |

---

## 2. Writing Dockerfiles (Single vs Multi-Stage)

A `Dockerfile` is a recipe for building an image. Two common styles:

- **Single-stage** — one `FROM`. Simple, but the final image carries build tools, dev
  dependencies, and source code → **larger & less secure**. Fine for quick dev/practice.
- **Multi-stage** — multiple `FROM` blocks. You **build** in one stage and copy only the
  final artifacts into a small **runtime** stage → **smaller, faster, more secure** images.
  This is the recommended approach for production.

> 💡 **Rule of thumb:** compiled/bundled apps (React, Java, TS) benefit *hugely* from
> multi-stage. Always add a `.dockerignore` (see end of section) to keep builds fast.

Key instructions: `FROM` (base image) · `WORKDIR` (set dir) · `COPY` (add files) ·
`RUN` (execute at build time) · `EXPOSE` (document port) · `CMD`/`ENTRYPOINT` (run at start).

---

### 2.1 React (Vite/CRA) — static frontend

**Single-stage** (dev/practice — serves via Vite preview, ships Node + node_modules):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
```

**Multi-stage** ✅ (build static assets, serve with tiny Nginx — image ~25 MB):
```dockerfile
# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci                      # clean, reproducible install
COPY . .
RUN npm run build               # outputs to /app/dist (Vite) or /app/build (CRA)

# ---- Stage 2: serve ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# For SPA routing, add a custom config that falls back to index.html:
# COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### 2.2 Node.js + TypeScript — API backend

**Single-stage** (dev/practice — keeps `ts-node` / devDeps):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build               # tsc → compiles src/ to dist/
EXPOSE 5000
CMD ["node", "dist/server.js"]
```

**Multi-stage** ✅ (compile with devDeps, ship only prod deps + `dist/`):
```dockerfile
# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci                      # includes devDependencies (typescript, types)
COPY src ./src
RUN npm run build               # tsc → dist/

# ---- Stage 2: runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev           # production dependencies only
COPY --from=build /app/dist ./dist
USER node                       # run as non-root (security)
EXPOSE 5000
CMD ["node", "dist/server.js"]
```

---

### 2.3 Java — Spring Boot (Maven)

**Single-stage** (dev/practice — ships the full JDK + Maven cache):
```dockerfile
FROM maven:3.9-eclipse-temurin-21
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests
EXPOSE 8080
CMD ["java", "-jar", "target/app.jar"]
```

**Multi-stage** ✅ (build the fat JAR with the JDK, run on a slim JRE):
```dockerfile
# ---- Stage 1: build ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline    # cache deps → faster rebuilds
COPY src ./src
RUN mvn clean package -DskipTests

# ---- Stage 2: runtime ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

### 2.4 Python — FastAPI

**Single-stage** (dev/practice — with hot-reload):
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Multi-stage** ✅ (install deps into a venv, copy into a clean runtime):
```dockerfile
# ---- Stage 1: build deps ----
FROM python:3.12-slim AS build
WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Stage 2: runtime ----
FROM python:3.12-slim
WORKDIR /app
COPY --from=build /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY . .
EXPOSE 8000
# Production: gunicorn managing uvicorn workers (no --reload)
CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", "--workers", "4"]
```

---

### 2.5 `.dockerignore` (always add one!)

Keeps build context small & prevents leaking secrets. Example covering all stacks:
```gitignore
# Node / React / TS
node_modules
dist
build
npm-debug.log
# Python
__pycache__
*.pyc
.venv
venv
# Java
target
# General
.git
.gitignore
.env
*.md
Dockerfile
.dockerignore
```

**Build & run any of the above:**
```bash
docker build -t myapp:dev .
docker run -p 8080:80 myapp:dev      # adjust ports per stack
```

---

## 3. Docker Compose

Define multi-container apps in `docker-compose.yml` (e.g. a backend + MongoDB + frontend).

| Command | Use Case |
|---------|----------|
| `docker compose up -d` | Start all services in the background |
| `docker compose up --build` | Rebuild images then start |
| `docker compose down` | Stop and remove containers/networks |
| `docker compose down -v` | Also remove volumes (⚠️ deletes data) |
| `docker compose logs -f backend` | Follow logs for one service |
| `docker compose ps` | List services and their status |
| `docker compose exec backend sh` | Shell into a service container |

**Minimal example:**
```yaml
services:
  backend:
    build: ./backend
    ports: ["5000:5000"]
    environment:
      - MONGO_URI=mongodb://db:27017/auth
    depends_on: [db]
  db:
    image: mongo:7
    volumes: ["mongodata:/data/db"]
volumes:
  mongodata:
```

---

## 4. Kubernetes Architecture

Kubernetes (K8s) runs a **cluster** = one or more **Control Plane** nodes + one or more **Worker Nodes**.

```
                     KUBERNETES CLUSTER
 ┌───────────────────────────────────────────────────────────┐
 │  CONTROL PLANE (the "brain" — decides desired state)        │
 │  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐   │
 │  │ kube-apiserver│  │  etcd         │  │ kube-scheduler  │   │
 │  │ (front door,  │  │ (key-value    │  │ (assigns pods   │   │
 │  │  all traffic) │  │  cluster DB)  │  │  to nodes)      │   │
 │  └───────────────┘  └──────────────┘  └─────────────────┘   │
 │  ┌────────────────────────┐  ┌───────────────────────────┐  │
 │  │ kube-controller-manager│  │ cloud-controller-manager  │  │
 │  │ (keeps actual = desired)│  │ (cloud provider hooks)   │  │
 │  └────────────────────────┘  └───────────────────────────┘  │
 └───────────────────────────────────────────────────────────┘
                              │  (API)
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
 ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
 │ WORKER NODE  │      │ WORKER NODE  │      │ WORKER NODE  │
 │ ┌──────────┐ │      │              │      │              │
 │ │ kubelet  │ │  ←── talks to apiserver, runs/monitors pods │
 │ ├──────────┤ │      │              │      │              │
 │ │kube-proxy│ │  ←── networking / service routing rules     │
 │ ├──────────┤ │      │              │      │              │
 │ │container │ │  ←── containerd / CRI-O runs the containers  │
 │ │ runtime  │ │      │              │      │              │
 │ ├──────────┤ │      │              │      │              │
 │ │ PODS     │ │  ←── smallest deployable unit (1+ containers)│
 │ └──────────┘ │      │              │      │              │
 └──────────────┘      └──────────────┘      └──────────────┘
```

### Control Plane components (the "brain")
| Component | Role |
|-----------|------|
| **kube-apiserver** | The front door. Every command/tool talks to it. Validates & serves the API. |
| **etcd** | Distributed key-value store — the single source of truth for cluster state. |
| **kube-scheduler** | Decides **which node** a new pod runs on (based on resources, affinity, taints). |
| **kube-controller-manager** | Runs control loops that reconcile *actual state → desired state*. |
| **cloud-controller-manager** | Integrates with cloud provider APIs (load balancers, volumes, nodes). |

### Worker Node components (where workloads run)
| Component | Role |
|-----------|------|
| **kubelet** | Agent on each node; ensures containers in pods are running & healthy. |
| **kube-proxy** | Maintains network rules; enables Service networking / load balancing. |
| **Container Runtime** | Actually runs containers (containerd, CRI-O). |
| **Pod** | Smallest deployable unit — one or more containers sharing network/storage. |

### Key Objects (what you actually deploy)
| Object | Purpose |
|--------|---------|
| **Pod** | One or more containers running together. |
| **Deployment** | Manages replicas of pods; handles rolling updates & rollbacks. |
| **ReplicaSet** | Ensures N pod replicas are running (managed by Deployment). |
| **Service** | Stable network endpoint (ClusterIP / NodePort / LoadBalancer). |
| **Ingress** | HTTP(S) routing into the cluster (host/path-based). |
| **ConfigMap** | Non-secret config as key-value pairs. |
| **Secret** | Sensitive data (passwords, tokens, keys) — base64 encoded. |
| **Namespace** | Virtual cluster / logical isolation of resources. |
| **PersistentVolume (PV) / PVC** | Storage abstraction and its claim. |

---

## 5. kubectl Essentials

`kubectl` is the CLI to talk to the cluster's API server.

### Viewing / Inspecting
| Command | Use Case |
|---------|----------|
| `kubectl get pods` | List pods in current namespace |
| `kubectl get pods -A` | List pods in **all** namespaces |
| `kubectl get pods -o wide` | Include node & IP info |
| `kubectl get deploy,svc,ingress` | List multiple resource types at once |
| `kubectl describe pod <name>` | Detailed info + events (great for debugging) |
| `kubectl logs <pod>` / `-f` | View / follow pod logs |
| `kubectl logs <pod> -c <container>` | Logs from a specific container in a pod |
| `kubectl get events --sort-by=.lastTimestamp` | Recent cluster events |

### Creating / Applying
| Command | Use Case |
|---------|----------|
| `kubectl apply -f app.yaml` | Create/update resources declaratively (**preferred**) |
| `kubectl apply -f ./k8s/` | Apply every manifest in a directory |
| `kubectl create deployment web --image=nginx` | Quick imperative create |
| `kubectl delete -f app.yaml` | Delete resources defined in a file |
| `kubectl delete pod <name>` | Delete a single pod (Deployment recreates it) |

### Interacting / Debugging
| Command | Use Case |
|---------|----------|
| `kubectl exec -it <pod> -- sh` | Shell into a running pod |
| `kubectl port-forward svc/web 8080:80` | Access a Service locally on localhost:8080 |
| `kubectl cp <pod>:/path/file .` | Copy files from a pod |
| `kubectl top pods` / `top nodes` | Live CPU/memory usage (needs metrics-server) |

### Scaling / Updating
| Command | Use Case |
|---------|----------|
| `kubectl scale deployment web --replicas=5` | Scale a deployment |
| `kubectl set image deployment/web web=nginx:1.25` | Rolling update to a new image |
| `kubectl rollout status deployment/web` | Watch a rollout progress |
| `kubectl rollout undo deployment/web` | Roll back to previous version |
| `kubectl rollout restart deployment/web` | Restart all pods (e.g. after config change) |

### Context & Namespaces
| Command | Use Case |
|---------|----------|
| `kubectl config get-contexts` | List available clusters/contexts |
| `kubectl config use-context <name>` | Switch cluster |
| `kubectl get ns` | List namespaces |
| `kubectl -n <namespace> get pods` | Run a command against a specific namespace |
| `kubectl config set-context --current --namespace=dev` | Set default namespace |

> 💡 **Tip:** `alias k=kubectl` and enable shell autocompletion — you type kubectl hundreds of times a day.

---

## 6. Kind (Kubernetes in Docker)

**Kind** runs a local Kubernetes cluster inside Docker containers — perfect for **local dev, testing, and CI**. No cloud needed.

### Install
```bash
# macOS
brew install kind
# Linux
[ $(uname -m) = x86_64 ] && curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind
# Windows (choco / winget)
choco install kind        #  OR:  winget install Kubernetes.kind
```

### Core commands
| Command | Use Case |
|---------|----------|
| `kind create cluster` | Create a default single-node cluster |
| `kind create cluster --name dev` | Create a named cluster |
| `kind get clusters` | List Kind clusters |
| `kind delete cluster --name dev` | Delete a cluster |
| `kind load docker-image myapp:1.0 --name dev` | Load a **local** image into the cluster (no registry push needed!) |
| `kubectl cluster-info --context kind-dev` | Verify connectivity |

### Multi-node cluster config
```yaml
# kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30080   # NodePort
        hostPort: 8080         # reachable on localhost:8080
  - role: worker
  - role: worker
```
```bash
kind create cluster --name dev --config kind-config.yaml
```

> 💡 **Kind's killer feature:** `kind load docker-image` — test locally-built images
> instantly without pushing to a registry.

---

## 7. Common Workflows / Use Cases

### A. Build → Load → Deploy locally with Kind
```bash
docker build -t myapp:dev .
kind create cluster --name dev
kind load docker-image myapp:dev --name dev
kubectl apply -f k8s/deployment.yaml
kubectl port-forward svc/myapp 8080:80
```

### B. Deploy an app (Deployment + Service)
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: myapp }
spec:
  replicas: 2
  selector: { matchLabels: { app: myapp } }
  template:
    metadata: { labels: { app: myapp } }
    spec:
      containers:
        - name: myapp
          image: myapp:dev
          ports: [{ containerPort: 5000 }]
---
apiVersion: v1
kind: Service
metadata: { name: myapp }
spec:
  selector: { app: myapp }
  ports: [{ port: 80, targetPort: 5000 }]
```
```bash
kubectl apply -f deployment.yaml
kubectl get pods -w        # watch pods come up
```

### C. Roll out a new version safely
```bash
kubectl set image deployment/myapp myapp=myapp:v2
kubectl rollout status deployment/myapp   # watch
kubectl rollout undo deployment/myapp     # revert if broken
```

### D. Inject config & secrets
```bash
kubectl create configmap app-config --from-literal=ENV=prod
kubectl create secret generic db-secret --from-literal=PASSWORD=s3cr3t
# reference them in your pod spec via envFrom / valueFrom
```

---

## 8. Troubleshooting Cheat Sheet

| Symptom | First command to run |
|---------|----------------------|
| Pod stuck `Pending` | `kubectl describe pod <name>` → check Events (usually resources/scheduling) |
| Pod `CrashLoopBackOff` | `kubectl logs <pod> --previous` → see why it died |
| `ImagePullBackOff` | Check image name/tag & registry auth; with Kind → did you `kind load`? |
| Can't reach service | `kubectl get svc`, `kubectl get endpoints <svc>`, verify selector labels match |
| Need to poke inside | `kubectl exec -it <pod> -- sh` |
| Node issues | `kubectl get nodes`, `kubectl describe node <name>` |
| Everything (quick scan) | `kubectl get all -A` |

---

> **Remember (80/20):** Master `docker build/run/ps/logs/exec`, `docker compose up/down`,
> and `kubectl get/describe/logs/apply/exec/port-forward` — these ~15 commands cover the
> vast majority of real work. Everything else you can look up when you need it.