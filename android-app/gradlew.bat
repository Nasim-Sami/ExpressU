@echo off
REM Gradle wrapper batch file (Windows)
REM Pinning to Gradle 7.6 for AGP 7.4.2 compatibility
set PRG=%~dp0\gradle\wrapper\gradle-wrapper.jar
java -jar "%PRG%" %*
