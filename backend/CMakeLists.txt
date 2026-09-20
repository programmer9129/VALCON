cmake_minimum_required(VERSION 3.20)


if(WIN32 AND EXISTS "C:/vcpkg/scripts/buildsystems/vcpkg.cmake")
    set(CMAKE_TOOLCHAIN_FILE
        "C:/vcpkg/scripts/buildsystems/vcpkg.cmake"
        CACHE STRING "vcpkg toolchain"
    )
endif()

project(ValconBackend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)


find_package(Crow CONFIG REQUIRED)
if(WIN32)
    set(CURL_INCLUDE_DIR "C:/vcpkg/installed/x64-windows/include")
    set(CURL_LIBRARY "C:/vcpkg/installed/x64-windows/lib/libcurl.lib")

    add_library(CURL::libcurl UNKNOWN IMPORTED)
    set_target_properties(CURL::libcurl PROPERTIES
        IMPORTED_LOCATION "${CURL_LIBRARY}"
        INTERFACE_INCLUDE_DIRECTORIES "${CURL_INCLUDE_DIR}"
    )
else()
    find_package(CURL REQUIRED)
endif()


find_package(CURL CONFIG REQUIRED)


file(GLOB_RECURSE VALCON_SOURCES
    CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/*.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/*.h"
)

list(FILTER VALCON_SOURCES
    EXCLUDE REGEX "/(out|build|\\.vs)/"
)


add_executable(ValconBackend
    ${VALCON_SOURCES}
)


target_link_libraries(ValconBackend
    PRIVATE
        Crow::Crow
        CURL::libcurl
)


if(WIN32)
    target_compile_definitions(
        ValconBackend
        PRIVATE
            VALCON_WINDOWS
    )
else()
    target_compile_definitions(
        ValconBackend
        PRIVATE
            VALCON_LINUX
    )
endif()
