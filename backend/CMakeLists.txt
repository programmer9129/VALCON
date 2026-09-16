cmake_minimum_required(VERSION 3.20)

project(ValconBackend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Crow CONFIG REQUIRED)

# Find all Valcon source/header files
file(GLOB_RECURSE VALCON_SOURCES
    CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/*.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/*.h"
)

# Do NOT include generated/build folders
list(FILTER VALCON_SOURCES EXCLUDE REGEX "/out/")
list(FILTER VALCON_SOURCES EXCLUDE REGEX "/\\.vs/")

add_executable(ValconBackend ${VALCON_SOURCES})

target_link_libraries(ValconBackend
    PRIVATE
    Crow::Crow
)