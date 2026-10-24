# Inventory Management System - CCA 2 CI/CD

This repository contains an existing React and Vite inventory management project, packaged as a Docker image and deployed to Kubernetes on Minikube by Jenkins.

## Application features

- Dashboard totals for products, units, low-stock items, and inventory value
- Add, edit, delete, search, and filter products
- Category-wise inventory report
- Browser local storage for inventory data

## Pipeline stages

The declarative `Jenkinsfile` runs these stages:

1. **Checkout** - Jenkins checks out the configured GitHub branch.
2. **Build and Test** - an ephemeral Node.js container runs `npm ci`, `npm run lint`, and `npm run build`. The project has no separate automated test suite, so lint and the production build are its checks.
3. **Build Docker Image** - builds the app using the repository `Dockerfile` and tags it with the Jenkins build number.
4. **Push Image** - logs in to Docker Hub with a Jenkins credential, then pushes both the build-number tag and `latest`.
5. **Deploy to Minikube** - applies the files in `k8s/` with the just-published image and waits for the Deployment rollout.
6. **Verify Deployment** - prints the Deployment, matching Pods, and Service so their state is visible in the Jenkins console output.

Jenkins polls the configured GitHub branch every five minutes. To demonstrate the required second run, change a visible app string, commit and push the change, then show the next successful build and the updated application.

## Repository files

- `src/` - React application source
- `Dockerfile` - multi-stage build; Nginx serves the production app on port 80
- `Jenkinsfile` - end-to-end declarative pipeline
- `k8s/deployment.yaml` - one-replica Kubernetes Deployment with health probes and resource limits
- `k8s/service.yaml` - NodePort Service on port 30080

## One-time setup

### 1. GitHub

The configured remote is https://github.com/anshitamehta22/inventory-management. Push this repository, including the Docker and Kubernetes files, to that GitHub repository. The repository must contain the `main` branch or the branch selected in the Jenkins job.

### 2. AWS EC2, Jenkins, Docker, and Minikube

Use the same Linux account for Minikube and the Jenkins agent context, or explicitly configure Jenkins so it can reach that account's Kubernetes context. Jenkins needs:

- Git and Docker CLI, with permission to run Docker commands
- `kubectl` and a running Minikube cluster reachable from the Jenkins process
- Enough EC2 memory and CPU to run Jenkins, Docker, and Minikube together
- Outbound access to GitHub, Docker Hub, and container image registries

Before running the pipeline, verify from the Jenkins execution account that `docker version`, `kubectl get nodes`, and `minikube status` work. Keep Jenkins and Minikube running on the same EC2 host for this pipeline.

### 3. Docker Hub

Create a Docker Hub repository named `inventory-management` and make it public so Minikube can pull the image without a Kubernetes registry secret. Create a Docker Hub access token for Jenkins.

In Jenkins, add a credential:

- Kind: **Username with password**
- ID: `dockerhub-credentials`
- Username: your Docker Hub username
- Password: the Docker Hub access token

Do not put the token in this repository or in the Jenkinsfile.

### 4. Jenkins Pipeline job

Create a **Pipeline** job and configure **Pipeline script from SCM**:

- SCM: Git
- Repository URL: your GitHub repository URL
- Branch: `*/main` (or the branch you use)
- Script path: `Jenkinsfile`

Save and run **Build Now**. The first run may take longer while Node and Docker images are downloaded.

## Run locally

Install Node.js 22, then run:

```sh
npm ci
npm run lint
npm run build
npm run dev
```

The development server prints a local URL, usually `http://localhost:5173`.

## Verify the Kubernetes deployment

After Jenkins reports success, check the cluster from the EC2 host:

```sh
kubectl get deployment inventory-management
kubectl get pods -l app=inventory-management
kubectl get service inventory-management
```

The Service exposes port 80 inside the cluster and NodePort 30080 on the Minikube node. To open the app through a local tunnel without adding a public AWS rule, run this on EC2:

```sh
kubectl port-forward --address 127.0.0.1 service/inventory-management 8081:80
```

Then create an SSH tunnel from your computer to EC2 for local port 8081, and visit `http://localhost:8081`. Do not share Jenkins or Docker Hub passwords in screenshots.

## Second-run demonstration

After the first successful deployment, make a small visible source change (for example, update the dashboard heading in `src/App.jsx`), commit and push it to the configured branch, and wait for Jenkins polling or start the job manually. Show the second successful build and open the deployed app to verify that the change is live.

## Assignment evidence checklist

- GitHub repository URL
- Jenkinsfile, Dockerfile, and both Kubernetes manifests in the repository
- Jenkins screenshots showing pipeline stages and a successful first build
- Docker Hub repository showing the published image tags
- Kubernetes output showing the Deployment, running Pod, and Service
- Screenshot of the app running
- Second source change in GitHub and the successful redeployment
- Brief explanation of setup, stages, access, and second-run change
