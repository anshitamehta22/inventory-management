# Inventory Management System - CCA 2 CI/CD

An existing academic project (a React + Vite inventory management app) delivered by a fully automated Jenkins pipeline: GitHub → Jenkins on AWS EC2 → tests → Docker image → Docker Hub → Kubernetes on Minikube.

## 1. The project

- Dashboard totals for products, stock units, low-stock items, and inventory value (₹)
- Add, edit, delete, search, and filter products
- Category-wise inventory report
- Data kept in browser local storage
- The sidebar shows **Build N**, the Jenkins build number that produced the running image, so every redeployment is visible in the app

## 2. Repository layout

| Path | Purpose |
|---|---|
| `src/` | React source. `src/inventory.js` holds the stock calculations and validation |
| `tests/inventory.test.js` | Unit tests (Node's built-in `node:test`, no extra dependencies) |
| `Dockerfile` | Multi-stage build: Node 22 builds the app, Nginx serves it on port 80 |
| `Jenkinsfile` | Declarative pipeline (checkout → build/test → image → push → deploy → verify) |
| `k8s/deployment.yaml` | Deployment: 1 replica, rolling update with no downtime, health probes, resource limits |
| `k8s/service.yaml` | NodePort Service on port 30080 |
| `scripts/ec2-setup.sh` | One-time installer for Docker, Jenkins, kubectl, and Minikube on Ubuntu EC2 |

## 3. Pipeline stages

| # | Stage | What happens |
|---|---|---|
| 1 | Source code | Code, Dockerfile, Jenkinsfile, and `k8s/` live in GitHub |
| 2 | **Checkout** | Jenkins pulls the latest commit (polls GitHub every 2 minutes, so a push triggers a build) |
| 3 | **Build and Test** | In a throwaway `node:22-alpine` container: `npm ci`, `npm run lint` (syntax/quality check), `npm test` (6 unit tests), `npm run build` (production bundle) |
| 4 | **Build Docker Image** | `docker build` from the Dockerfile, tagged with the Jenkins build number and `latest`; the build number is baked into the app |
| 5 | **Push Image** | Logs in with the `dockerhub-credentials` Jenkins credential and pushes `<user>/inventory-management:<build>` and `:latest` |
| 6 | **Deploy to Minikube** | Substitutes the new image tag into `k8s/deployment.yaml`, applies both manifests, records the change cause, waits for the rollout |
| 7 | **Verify Deployment** | Prints deployment, pods, service, and rollout history; checks that the pods run this build's image; fetches the home page through the Service and fails the build if it does not respond |

If any stage fails, later stages do not run, so a broken commit never reaches the cluster.

## 4. Setting up Jenkins on AWS

### 4.1 Launch EC2

- AMI: **Ubuntu Server 24.04 LTS**, instance type **t3.medium** (2 vCPU / 4 GB; Jenkins + Docker + Minikube need it) or larger, **20-30 GB** gp3 disk
- Key pair: create/download a `.pem` key
- Security group inbound rules:
  - SSH 22 from **My IP**
  - Custom TCP 8080 (Jenkins) from **My IP**
  - (optional) Custom TCP 8081 from My IP if you expose the app directly instead of using an SSH tunnel

### 4.2 Install the tools

```sh
ssh -i your-key.pem ubuntu@<EC2-public-IP>
git clone https://github.com/anshitamehta22/inventory-management.git
cd inventory-management
bash scripts/ec2-setup.sh
```

The script installs Docker, Jenkins, kubectl, and Minikube, adds `jenkins` to the `docker` group, and starts Minikube **as the `jenkins` user** so the pipeline's `kubectl` talks to that cluster. It prints the initial Jenkins admin password at the end.

Check from the Jenkins account:

```sh
sudo -u jenkins -H docker ps
sudo -u jenkins -H kubectl get nodes
sudo -u jenkins -H minikube status
```

> After an EC2 stop/start, run `sudo -u jenkins -H minikube start` again before building.

### 4.3 Configure Jenkins

1. Open `http://<EC2-public-IP>:8080`, paste the admin password, choose **Install suggested plugins** (includes Git, Pipeline, Credentials Binding, Timestamper), and create an admin user.
2. **Docker Hub token**: on hub.docker.com → Account settings → Personal access tokens → generate one with Read & Write. Create a **public** repository named `inventory-management`.
3. **Jenkins credential**: Manage Jenkins → Credentials → System → Global → Add credentials
   - Kind: *Username with password*
   - Username: your Docker Hub username
   - Password: the access token
   - ID: `dockerhub-credentials`
4. **Pipeline job**: New Item → `inventory-management` → *Pipeline* → under Pipeline choose *Pipeline script from SCM*
   - SCM: Git, URL `https://github.com/anshitamehta22/inventory-management.git`
   - Branch: `*/main`, Script path: `Jenkinsfile`
5. Save → **Build Now**. The first run downloads Node/Nginx images and takes longer. After the first run the `pollSCM` trigger is registered and later pushes build automatically.

The token lives only in Jenkins credentials; it is never in the repository and is masked in the console log.

## 5. Pushing the image

The Push Image stage tags the image as `docker.io/<dockerhub-user>/inventory-management:<BUILD_NUMBER>` (a unique, traceable tag) plus `latest`, then pushes both. Check Docker Hub → your repository → **Tags**.

## 6. Deploying and accessing the app

Jenkins applies the manifests; Kubernetes pulls the image from Docker Hub (`imagePullPolicy: Always`). On EC2:

```sh
sudo -u jenkins -H kubectl get deployment,pods,svc -l app=inventory-management
sudo -u jenkins -H kubectl rollout history deployment/inventory-management
```

Open the app in your browser (pick one):

**A. SSH tunnel (no extra AWS ports).** On EC2:

```sh
sudo -u jenkins -H kubectl port-forward service/inventory-management 8081:80
```

On your laptop, in another terminal:

```sh
ssh -i your-key.pem -L 8081:localhost:8081 ubuntu@<EC2-public-IP>
```

Then visit `http://localhost:8081`.

**B. Public URL.** Open port 8081 in the security group, then on EC2:

```sh
sudo -u jenkins -H kubectl port-forward --address 0.0.0.0 service/inventory-management 8081:80
```

Visit `http://<EC2-public-IP>:8081`.

## 7. Second run: code change and redeploy

1. Note the current build in the app sidebar, e.g. **Build 1**.
2. Make a visible change, for example in `src/App.jsx` change the header text `Basic Inventory Management System` to `Inventory Management System - v2`.
3. Commit and push:

   ```sh
   git add src/App.jsx
   git commit -m "Update dashboard header for v2"
   git push origin main
   ```

4. Within about 2 minutes Jenkins starts build #2 on its own (or click **Build Now**).
5. Show: the new build's stages all green, the `:2` tag on Docker Hub, `kubectl rollout history` with revision 2, and the refreshed app showing the new header and **Build 2**.

## 8. Run locally

```sh
npm ci
npm run lint
npm test
npm run build
npm run dev
```

## 9. Screenshot checklist

- [ ] GitHub repository showing `Jenkinsfile`, `Dockerfile`, `k8s/`
- [ ] EC2 instance running (console) and security group rules
- [ ] Jenkins dashboard, installed plugins, `dockerhub-credentials` (ID only, no secret)
- [ ] Pipeline job configuration (SCM + Jenkinsfile path)
- [ ] Build #1 Stage View, all stages green
- [ ] Console output showing tests passing and the Verify stage output
- [ ] Docker Hub repository with build tags
- [ ] `kubectl get deployment,pods,svc` output
- [ ] App running in the browser (Build 1)
- [ ] GitHub commit for the change
- [ ] Build #2 Stage View, rollout history, and app showing the change (Build 2)

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `permission denied ... docker.sock` | `sudo usermod -aG docker jenkins && sudo systemctl restart jenkins` |
| `kubectl` connection refused in Jenkins | Minikube is stopped or was started as another user: `sudo -u jenkins -H minikube start` |
| `ErrImagePull` / `ImagePullBackOff` | Docker Hub repository is private, or the username in the credential is wrong |
| `denied: requested access to the resource` on push | Token lacks write permission, or repository name mismatch |
| Build hangs or EC2 freezes | Instance too small; use t3.medium or larger |
| Disk full | `docker system prune -af` on EC2 (the pipeline also prunes dangling images) |
