cmake_minimum_required(VERSION 3.20)

project(ValconBackend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Find Crow from vcpkg
find_package(Crow CONFIG REQUIRED)

# Automatically find all .cpp and .h files
file(GLOB_RECURSE VALCON_SOURCES
    CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/*.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/*.h"
)

# Build the backend
add_executable(ValconBackend ${VALCON_SOURCES})

# Link Crow
target_link_libraries(ValconBackend PRIVATE Crow::Crow)