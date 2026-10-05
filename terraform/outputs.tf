output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.medicine_server.public_ip
}

output "instance_public_dns" {
  description = "Public DNS of the EC2 instance"
  value       = aws_instance.medicine_server.public_dns
}

output "ssh_connection_command" {
  description = "Command to SSH into the instance"
  value       = "ssh -i medicine-key ubuntu@${aws_instance.medicine_server.public_ip}"
}
