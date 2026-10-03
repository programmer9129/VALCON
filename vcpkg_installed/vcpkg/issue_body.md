Package: openssl:x64-windows@3.6.3

**Host Environment**

- Host: x64-windows
- Compiler: MSVC 19.51.36257.0
- CMake Version: 4.4.0
-    vcpkg-tool version: 2026-07-27-98d7cb0cf1f4686a3e43aa5672b6230c1d56bce8
    vcpkg-readonly: true
    vcpkg-scripts version: 1460b31b08c42cc2e9ac2c79f45ec8707e2675e2

**To Reproduce**

`vcpkg install `

**Failure logs**

```
Downloading https://github.com/openssl/openssl/archive/openssl-3.6.3.tar.gz -> openssl-openssl-openssl-3.6.3.tar.gz
Successfully downloaded openssl-openssl-openssl-3.6.3.tar.gz
-- Extracting source C:/Users/USER/AppData/Local/vcpkg/downloads/openssl-openssl-openssl-3.6.3.tar.gz
-- Applying patch cmake-config.patch
-- Applying patch command-line-length.patch
-- Applying patch script-prefix.patch
-- Applying patch windows/install-layout.patch
-- Applying patch windows/install-pdbs.patch
-- Applying patch windows/install-programs.diff
-- Applying patch unix/android-cc.patch
-- Applying patch unix/move-openssldir.patch
-- Applying patch unix/no-empty-dirs.patch
-- Applying patch unix/no-static-libs-for-shared.patch
-- Using source at E:/GitHub/VALCON/VALCON/vcpkg_installed/vcpkg/blds/openssl/src/nssl-3.6.3-28a9d34a24.clean
-- Getting CMake variables for x64-windows
-- Loading CMake variables from E:/GitHub/VALCON/VALCON/vcpkg_installed/vcpkg/blds/openssl/cmake-get-vars_C_CXX-x64-windows.cmake.log
Downloading https://github.com/StrawberryPerl/Perl-Dist-Strawberry/releases/download/SP_54221_64bit/strawberry-perl-5.42.2.1-64bit-portable.zip -> strawberry-perl-5.42.2.1-64bit-portable.zip
error: curl operation failed with error code 56 (Failure when receiving data from the peer).
error: Not a transient network error, won't retry download from https://github.com/StrawberryPerl/Perl-Dist-Strawberry/releases/download/SP_54221_64bit/strawberry-perl-5.42.2.1-64bit-portable.zip
note: If you are using a proxy, please ensure your proxy settings are correct.
Possible causes are:
1. You are actually using an HTTP proxy, but setting HTTPS_PROXY variable to `https://address:port`.
This is not correct, because `https://` prefix claims the proxy is an HTTPS proxy, while your proxy (v2ray, shadowsocksr, etc...) is an HTTP proxy.
Try setting `http://address:port` to both HTTP_PROXY and HTTPS_PROXY instead.
2. If you are using Windows, vcpkg will automatically use your Windows IE Proxy Settings set by your proxy software. See: https://github.com/microsoft/vcpkg-tool/pull/77
The value set by your proxy might be wrong, or have same `https://` prefix issue.
3. Your proxy's remote server is out of service.
If you believe this is not a temporary download server failure and vcpkg needs to be changed to download this file from a different location, please submit an issue to https://github.com/Microsoft/vcpkg/issues
CMake Error at scripts/cmake/vcpkg_download_distfile.cmake:134 (message):
  Download failed, halting portfile.
Call Stack (most recent call first):
  scripts/cmake/vcpkg_find_acquire_program.cmake:206 (z_vcpkg_download_distfile)
  C:/Users/USER/AppData/Local/vcpkg/registries/git-trees/b4a2360e8425d8d5e2a24436804b592bef26980b/windows/portfile.cmake:6 (vcpkg_find_acquire_program)
  C:/Users/USER/AppData/Local/vcpkg/registries/git-trees/b4a2360e8425d8d5e2a24436804b592bef26980b/portfile.cmake:77 (include)
  scripts/ports.cmake:209 (include)



```

**Additional context**

<details><summary>vcpkg.json</summary>

```
{
  "dependencies": [
    "openssl"
  ]
}

```
</details>
