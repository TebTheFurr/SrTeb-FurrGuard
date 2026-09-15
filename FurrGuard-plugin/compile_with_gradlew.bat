@echo off
REM Script para descargar Gradle Wrapper y compilar
REM Esto descarga Gradle automaticamente, no necesita instalacion
REM
REM =========================================================================

echo.
echo ========================================
echo FurrGuard - Auto-Compilador
echo ========================================
echo.
echo Este script descargara Gradle automaticamente
echo y compilara el plugin.
echo.

REM Verificar Java
echo Verificando Java...
java -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java no esta instalado
    echo.
    echo Por favor instala Java 17+:
    echo https://www.oracle.com/java/technologies/downloads/
    echo.
    pause
    exit /b 1
)
echo Java encontrado: OK
java -version

echo.
echo Creando Gradle Wrapper...
echo.

REM Crear gradlew wrapper files manualmente
if not exist gradlew (
    REM Crear un script simple que descarga gradle
    echo Iniciando descarga de Gradle...

    REM Crear directorio wrapper
    if not exist gradle mkdir gradle
    if not exist gradle\wrapper mkdir gradle\wrapper

    REM Descargar gradle-wrapper.jar
    echo Descargando gradle-wrapper.jar...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/gradle/gradle/raw/v8.5.0/gradle/wrapper/gradle-wrapper.jar' -OutFile 'gradle\wrapper\gradle-wrapper.jar'"

    REM Crear gradle-wrapper.properties
    echo distributionBase=GRADLE_USER_HOME> gradle\wrapper\gradle-wrapper.properties
    echo distributionPath=wrapper/dists>> gradle\wrapper\gradle-wrapper.properties
    echo distributionUrl=https://services.gradle.org/distributions/gradle-8.5-bin.zip>> gradle\wrapper\gradle-wrapper.properties
    echo zipStoreBase=GRADLE_USER_HOME>> gradle\wrapper\gradle-wrapper.properties
    echo zipStorePath=wrapper/dists>> gradle\wrapper\gradle-wrapper.properties
    echo zipStoreUrl=https://services.gradle.org/distributions/gradle-8.5-bin.zip>> gradle\wrapper\gradle-wrapper.properties

    REM Crear gradlew.bat para Windows
    echo @echo off> gradlew.bat
    echo setlocal>> gradlew.bat
    echo set DIRNAME=%%~dp0>> gradlew.bat
    echo if "%%DIRNAME%%"=="" set DIRNAME=.>> gradlew.bat
    echo set APP_BASE_NAME=%%~n0>> gradlew.bat
    echo set APP_HOME=%%DIRNAME%%>> gradlew.bat
    echo FOR %%i IN ("%%APP_HOME%%") DO set APP_HOME=%%~fi>> gradlew.bat
    echo set WRAPPER_HOME=%%APP_HOME%%\gradle\wrapper>> gradlew.bat
    echo call "%%WRAPPER_HOME%%\gradlew.bat" %%*>> gradlew.bat

    echo.
    echo Wrapper creado (o ya existia): OK
)

echo.
echo Limpiando build anterior...
call gradlew.bat clean 2>nul

echo.
echo Compilando plugin...
echo Esto puede tomar varios minutos la primera vez...
echo.
call gradlew.bat shadowJar

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: La compilacion fallo
    echo ========================================
    echo.
    echo Posibles causas:
    echo   - Java no es version 17+
    echo   - Error de red al descargar Gradle
    echo   - Error en el codigo fuente
    echo.
    echo Revisa los errores arriba para mas detalles.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo COMPILACION EXITOSA!
echo ========================================
echo.
echo El JAR compilado esta en:
echo   build\libs\FurrGuard-1.0.0.jar
echo.
echo.
dir build\libs\FurrGuard-1.0.0.jar
echo.
echo.
echo ========================================
echo SIGUIENTES PASOS
echo ========================================
echo.
echo 1. Haz backup del JAR anterior en tu servidor:
echo    copy plugins\FurrGuard-1.0.0.jar plugins\FurrGuard-1.0.0.jar.backup
echo.
echo 2. Copia el nuevo JAR al servidor:
echo    copy build\libs\FurrGuard-1.0.0.jar plugins\
echo.
echo 3. Reinicia el servidor o recarga el plugin:
echo    /furrguard reload
echo.
echo 4. MONITOREA los logs durante 30 minutos:
echo    tail -f logs/latest.log (o equivalente en Windows)
echo.
echo 5. Verifica que jugadores puedan conectarse
echo.
echo.
pause
