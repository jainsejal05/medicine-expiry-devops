# ===== Provider Configuration =====
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ===== Key Pair (uses the SSH key you generated locally) =====
resource "aws_key_pair" "medicine_key" {
  key_name   = var.key_name
  public_key = file(var.public_key_path)
}

# ===== Security Group - controls what traffic is allowed =====
resource "aws_security_group" "medicine_sg" {
  name        = "medicine-expiry-sg"
  description = "Allow SSH and app traffic for Medicine Expiry Tracker"

  # SSH access (needed for Ansible to configure the server)
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Flask backend app port
  ingress {
    description = "Flask App"
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Frontend (served on port 80 via simple hosting, set up in this phase)
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic (so the EC2 instance can download packages, Docker images, etc.)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "medicine-expiry-sg"
  }
}

# ===== Get the latest Ubuntu 22.04 AMI automatically (so we don't hardcode an ID that expires) =====
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical (official Ubuntu publisher)

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ===== EC2 Instance =====
resource "aws_instance" "medicine_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.medicine_key.key_name
  vpc_security_group_ids = [aws_security_group.medicine_sg.id]

  tags = {
    Name = "medicine-expiry-server"
  }
}
