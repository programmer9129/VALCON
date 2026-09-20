// Precompiled header to reduce repetitive parsing of heavy system and third-party headers
#pragma once

// Reduce windows.h bloat
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif

// Include winsock2 before windows
#include <winsock2.h>
#include <windows.h>
#include <tchar.h>

// Intrinsics commonly brought in by many translation units
#include <intrin.h>
#include <immintrin.h>
#include <zmmintrin.h>

// libcurl top-level header (which pulls in curl_setup.h / setup-win32.h)
#include <curl/curl.h>
