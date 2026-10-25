pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        timestamps()
        disableConcurrentBuilds()
    }

    triggers {
        // Checks GitHub every few minutes and builds automatically when a new commit is pushed
        pollSCM('H/2 * * * *')
    }

    environment {
        IMAGE_NAME = 'inventory-management'
        IMAGE_TAG = "${BUILD_NUMBER}"
        DOCKERHUB_CREDENTIALS_ID = 'dockerhub-credentials'
        VERIFY_PORT = '18080'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --oneline'
            }
        }

        stage('Build and Test') {
            steps {
                // Runs in a throwaway Node container so the EC2 host does not need Node installed.
                // Lint checks syntax, node:test runs the unit tests in tests/, and the Vite build
                // proves the production bundle compiles.
                sh '''
                    docker run --rm \
                      --user "$(id -u):$(id -g)" \
                      -e HOME=/tmp \
                      -v "$WORKSPACE:/workspace" \
                      -w /workspace \
                      node:22-alpine \
                      sh -c 'npm ci && npm run lint && npm test && npm run build'
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build \
                      --build-arg APP_VERSION="$IMAGE_TAG" \
                      --tag "$IMAGE_NAME:$IMAGE_TAG" \
                      --tag "$IMAGE_NAME:latest" \
                      .
                    docker image ls "$IMAGE_NAME"
                '''
            }
        }

        stage('Push Image') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: env.DOCKERHUB_CREDENTIALS_ID,
                    usernameVariable: 'DOCKERHUB_USER',
                    passwordVariable: 'DOCKERHUB_TOKEN'
                )]) {
                    script {
                        env.IMAGE_REPOSITORY = "docker.io/${env.DOCKERHUB_USER}/${env.IMAGE_NAME}"
                    }
                    sh '''
                        set +x
                        printf '%s' "$DOCKERHUB_TOKEN" | docker login \
                          --username "$DOCKERHUB_USER" \
                          --password-stdin
                        docker tag "$IMAGE_NAME:$IMAGE_TAG" "$IMAGE_REPOSITORY:$IMAGE_TAG"
                        docker tag "$IMAGE_NAME:latest" "$IMAGE_REPOSITORY:latest"
                        docker push "$IMAGE_REPOSITORY:$IMAGE_TAG"
                        docker push "$IMAGE_REPOSITORY:latest"
                    '''
                }
            }
        }

        stage('Deploy to Minikube') {
            steps {
                sh '''
                    sed "s|__IMAGE__|$IMAGE_REPOSITORY:$IMAGE_TAG|g" \
                      k8s/deployment.yaml | kubectl apply -f -
                    kubectl apply -f k8s/service.yaml
                    kubectl annotate deployment/inventory-management \
                      kubernetes.io/change-cause="Jenkins build $BUILD_NUMBER ($(git rev-parse --short HEAD))" \
                      --overwrite
                    kubectl rollout status deployment/inventory-management --timeout=180s
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    kubectl get deployment inventory-management
                    kubectl get pods -l app=inventory-management -o wide
                    kubectl get service inventory-management
                    kubectl rollout history deployment/inventory-management

                    # Confirm the running pods use the image this build pushed
                    DEPLOYED_IMAGE="$(kubectl get deployment inventory-management \
                      -o jsonpath='{.spec.template.spec.containers[0].image}')"
                    echo "Deployed image: $DEPLOYED_IMAGE"
                    test "$DEPLOYED_IMAGE" = "$IMAGE_REPOSITORY:$IMAGE_TAG"

                    # Confirm the app answers over HTTP through the Kubernetes Service
                    kubectl port-forward service/inventory-management "$VERIFY_PORT:80" >/dev/null 2>&1 &
                    PF_PID=$!
                    trap 'kill $PF_PID 2>/dev/null || true' EXIT
                    PAGE="$WORKSPACE/verify-index.html"
                    rm -f "$PAGE"
                    for i in $(seq 1 15); do
                      if curl -fsS "http://127.0.0.1:$VERIFY_PORT/" -o "$PAGE"; then
                        break
                      fi
                      sleep 2
                    done
                    grep -q '<div id="root">' "$PAGE"
                    echo "Application is responding on the inventory-management Service"
                '''
            }
        }
    }

    post {
        success {
            echo "Deployed ${env.IMAGE_REPOSITORY}:${env.IMAGE_TAG} to Minikube"
        }
        always {
            sh '''
                docker logout || true
                # Keep EC2 disk usage down: remove old local images left by earlier builds
                docker image prune -f || true
            '''
        }
    }
}
