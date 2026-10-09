// Pipeline as Code: this file IS the Jenkins pipeline definition (lives in Git).
pipeline {
    agent any

    options {
        timeout(time: 20, unit: 'MINUTES')
    }

    // Jenkins runs on a laptop, so GitHub cannot call it with a webhook.
    // Instead Jenkins asks GitHub for new commits every 2 minutes.
    triggers {
        pollSCM('H/2 * * * *')
    }

    environment {
        EC2_HOST = '65.1.56.149'
        ANSIBLE_HOST_KEY_CHECKING = 'False'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Unit Tests') {
            steps {
                sh '''
                    python3 -m venv venv
                    . venv/bin/activate
                    pip install -q -r backend/requirements.txt
                    cd backend
                    python -m pytest test_app.py -v
                '''
            }
        }

        stage('Deploy with Ansible') {
            steps {
                withCredentials([sshUserPrivateKey(credentialsId: 'ec2-ssh-key', keyFileVariable: 'SSH_KEY')]) {
                    sh '''
                        cd ansible
                        echo "[medicine_server]" > inventory.jenkins.ini
                        echo "${EC2_HOST} ansible_user=ubuntu ansible_ssh_private_key_file=${SSH_KEY}" >> inventory.jenkins.ini
                        ansible-playbook -i inventory.jenkins.ini deploy.yml
                    '''
                }
            }
        }

        stage('Smoke Test') {
            steps {
                sh 'curl -sf http://${EC2_HOST}:5000/api/health'
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
