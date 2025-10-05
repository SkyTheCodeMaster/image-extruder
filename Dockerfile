FROM python:3.11-slim

COPY . /app/
WORKDIR /app/src/

RUN apt update -y && apt install -y git build-essential tree wget

# Install requirements
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r ./requirements.txt
# install utilities, potrace and imagemagick
RUN apt install potrace imagemagick
# install openscad
RUN wget -o /bin/OpenSCAD-2021.01-x86_64.AppImage https://files.openscad.org/OpenSCAD-2021.01-x86_64.AppImage

# Run the main script
CMD ["python", "main.py"]