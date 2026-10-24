pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        timestamps()
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    environment {
        IMAGE_NAME = 'inventory-management'
        IMAGE_TAG = "${BUILD_NUMBER}"
        DOCKERHUB_CREDENTIALS_ID = 'dockerhub-credentials'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build and Test') {
            steps {
                // This project has no separate test suite. Linting and a production build
                // provide the syntax and build checks required by the student guide.
                sh '''
                    docker run --rm \
                      --user "$(id -u):$(id -g)" \
                      -e HOME=/tmp \
                      -v "$WORKSPACE:/workspace" \
                      -w /workspace \
                      node:22-alpine \
                      sh -c 'npm ci && npm run lint && npm run build'
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build \
                      --tag "$IMAGE_NAME:$IMAGE_TAG" \
                      --tag "$IMAGE_NAME:latest" \
                      .
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
                '''
            }
        }
    }

    post {
        always {
            sh 'docker logout || true'
        }
    }
}
