# Use a lightweight official Python image
FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Copy only requirements first (Docker caches this layer if requirements.txt doesn't change,
# so rebuilds are faster when only app code changes)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code into the container
COPY . .

# Flask app listens on this port inside the container
EXPOSE 5000

# Command to run when the container starts
CMD ["python", "app.py"]