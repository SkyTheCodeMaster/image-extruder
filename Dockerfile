FROM python:3.11-slim

COPY . /app/
WORKDIR /app/src/

RUN apt update -y && apt install -y git build-essential tree

# Install requirements
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r ./requirements.txt


# Run the main script
CMD ["python", "main.py"]