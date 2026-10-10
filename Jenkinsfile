// Pipeline as Code - this file IS the Jenkins pipeline definition (stored in Git).
// Jenkins runs on Windows. Python tests run on Windows Python.
// Ansible does not run on Windows, so Jenkins calls it inside WSL.
pipeline {
    agent any

    options {
        timeout(time: 20, unit: 'MINUTES')
    }

    // Jenkins is on a laptop, so GitHub cannot call it with a webhook.
    // Instead Jenkins asks GitHub for new commits every 2 minutes.
    triggers {
        pollSCM('H/2 * * * *')
    }

    environment {
        EC2_HOST = '65.1.56.149'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Unit Tests') {
            steps {
                bat 'python -m venv venv'
                bat 'venv\\Scripts\\python -m pip install -q -r backend\\requirements.txt'
                bat 'cd backend && ..\\venv\\Scripts\\python -m pytest test_app.py -v'
            }
        }

        stage('Ansible Ping') {
            steps {
                bat 'wsl --cd "%WORKSPACE%\\ansible" ansible all -i inventory.ini -m ping'
            }
        }

        stage('Deploy with Ansible') {
            steps {
                bat 'wsl --cd "%WORKSPACE%\\ansible" ansible-playbook -i inventory.ini deploy.yml'
            }
        }

        stage('Smoke Test') {
            steps {
                bat 'curl.exe -sf http://%EC2_HOST%:5000/api/health'
            }
        }
    }

    post {
        success {
            echo 'Pipeline finished: tests passed, deployed to EC2, health check OK.'
        }
        failure {
            echo 'Pipeline FAILED - open Console Output and read the first red error.'
        }
    }
}