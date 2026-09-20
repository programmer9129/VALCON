FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    g++ \
    cmake \
    make \
    git \
    libboost-all-dev \
    libasio-dev \
    libcurl4-openssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/CrowCpp/Crow.git /opt/crow

WORKDIR /app

COPY . .

RUN g++ -std=c++17 \
    -I/opt/crow/include \
    backend/Super_file_base.cpp \
    -o backend_app \
    -lcurl \
    -pthread

CMD ["./backend_app"]
