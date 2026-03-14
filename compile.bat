@echo off
REM Script para compilar FurrGuard Plugin en Windows
REM
REMB Requisitos:
REM   - Java 17 o superior
REM   - Gradle 8.5 o superior
REM
REM Instalar Gradle:
REM   Opción 1: choco install gradle
REM   Opción 2: Descargar de https://gradle.org/install/
REM
REM =========================================================================

echo.
echo ========================================
echo FurrGuard Plugin - Compilador
echo ========================================
echo.

REM Verificar Java
echo [1/4] Verificando Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java no esta instalado o no esta en PATH
    echo Instalar Java 17+: https://www.oracle.com/java/technologies/downloads/
    pause
    exit /b 1
)
echo OK: Java encontrado
java -version

echo.

REM Verificar Gradle
echo [2/4] Verificando Gradle...
gradle --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Gradle no esta instalado o no esta en PATH
    echo.
    echo Opciones para instalar Gradle:
    echo   1. Usar Chocolatey: choco install gradle
    echo   2. Descargar manualmente: https://gradle.org/install/
    echo   3. Usar SDKMAN: sdk install gradle 8.5
    echo.
    pause
    exit /b 1
)
echo OK: Gradle encontrado
gradle --version

echo.

REM Limpiar builds anteriores
echo [3/4] Limpiando builds anteriores...
gradle clean
if errorlevel 1 (
    echo WARNING: Fallo al limpiar, continuando...
)

echo.

REM Compilar
echo [4/4] Compilando plugin...
echo.
gradle shadowJar
if errorlevel 1 (
    echo.
    echo ERROR: Fallo la compilacion
    echo Revisa los errores arriba
    pause
    exit /b 1
)

echo.
echo ========================================
echo COMPILACION EXITOSA!
echo ========================================
echo.
echo El JAR esta en:
echo   build\libs\FurrGuard-1.0.0.jar
echo.
echo Fecha:
dir /T:W build\libs\FurrGuard-1.0.0.jar
echo.
echo Siguientes pasos:
echo   1. Copia el JAR a tu servidor: plugins\FurrGuard-1.0.0.jar
echo   2. Haz backup del JAR anterior
echo   3. Reinicia el servidor o usa: /furrguard reload
echo   4. Monitorea los logs durante 30 minutos
echo.
pause
