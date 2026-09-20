cmake_minimum_required(VERSION 3.20)

project(ValconBackend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)



include(FetchContent)


FetchContent_Declare(
    Crow
    GIT_REPOSITORY https://github.com/CrowCpp/Crow.git
    GIT_TAG master
)

set(CROW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(CROW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(CROW_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(CROW_BUILD_DOCS OFF CACHE BOOL "" FORCE)

FetchContent_MakeAvailable(Crow)


find_package(CURL REQUIRED)




file(GLOB_RECURSE VALCON_SOURCES
    CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/*.cpp"
)




add_executable(ValconBackend
    ${VALCON_SOURCES}
)



target_include_directories(ValconBackend
    PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}"
)



target_link_libraries(ValconBackend
    PRIVATE
    Crow::Crow
    CURL::libcurl
)



if(UNIX AND NOT APPLE)
    find_package(Threads REQUIRED)

    target_link_libraries(ValconBackend
        PRIVATE
        Threads::Threads
    )
endif()



if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()