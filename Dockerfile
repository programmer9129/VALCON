FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    g++ \
    cmake \
    make \
    libboost-all-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN g++ -std=c++17 backend/Super_file_base.cpp -o backend -pthread

EXPOSE 8080

CMD ["./backend"]
