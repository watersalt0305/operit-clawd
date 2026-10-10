#!/bin/bash
# 编译 ClawdHost.java -> resources/native/clawd_host.dex
# 依赖：openjdk-17、~/sdk/android.jar (API 26)、~/sdk/r8.jar (d8)
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(dirname "$SRC_DIR")"
WORK=$(mktemp -d)
javac -source 8 -target 8 -Xlint:-options -encoding UTF-8 \
  -classpath ~/sdk/android.jar -d "$WORK/cls" \
  "$SRC_DIR"/clawd_pet/*.java || exit 1
mkdir -p "$WORK/out"
java -cp ~/sdk/r8.jar com.android.tools.r8.D8 --min-api 26 \
  --lib ~/sdk/android.jar --output "$WORK/out" \
  $(find "$WORK/cls" -name '*.class') || exit 1
mkdir -p "$PKG_DIR/resources/native"
cp "$WORK/out/classes.dex" "$PKG_DIR/resources/native/clawd_host.dex"
rm -rf "$WORK"
ls -la "$PKG_DIR/resources/native/clawd_host.dex"
