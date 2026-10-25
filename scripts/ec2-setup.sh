#!/usr/bin/env bash
# One-time setup for an Ubuntu 22.04/24.04 EC2 instance (t3.medium or larger, 20+ GB disk).
# Installs Docker, Jenkins, kubectl and Minikube, and starts Minikube as the jenkins user
# so the pipeline's kubectl commands reach the cluster.
#
# Usage on the EC2 instance:  bash scripts/ec2-setup.sh
set -euo pipefail

echo "==> Base packages"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git fontconfig openjdk-17-jre conntrack

echo "==> Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo systemctl enable --now docker

echo "==> Jenkins"
if ! command -v jenkins >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL -o /etc/apt/keyrings/jenkins-keyring.asc \
    https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key
  echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
    | sudo tee /etc/apt/sources.list.d/jenkins.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y jenkins
fi
# Jenkins must be able to run docker without sudo
sudo usermod -aG docker jenkins
sudo usermod -aG docker "$USER"

echo "==> kubectl"
if ! command -v kubectl >/dev/null 2>&1; then
  KUBECTL_VERSION="$(curl -fsSL https://dl.k8s.io/release/stable.txt)"
  curl -fsSLo /tmp/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
  sudo install -m 0755 /tmp/kubectl /usr/local/bin/kubectl
fi

echo "==> Minikube"
if ! command -v minikube >/dev/null 2>&1; then
  curl -fsSLo /tmp/minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
  sudo install -m 0755 /tmp/minikube /usr/local/bin/minikube
fi

sudo systemctl restart jenkins

echo "==> Starting Minikube as the jenkins user (docker driver)"
sudo -u jenkins -H minikube start --driver=docker --memory=2048 --cpus=2
sudo -u jenkins -H kubectl get nodes

echo
echo "Setup complete."
echo "Jenkins URL:            http://<EC2-public-IP>:8080"
echo "Initial admin password: $(sudo cat /var/lib/jenkins/secrets/initialAdminPassword 2>/dev/null || echo 'see /var/lib/jenkins/secrets/initialAdminPassword')"
echo "Log out and back in so your own user picks up the docker group."
