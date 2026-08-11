#!/bin/bash
cd "$(dirname "$0")"

(
  sleep 3
  echo "/dialog input pass 112233"
  sleep 1
  echo "/dialog click 1"
  sleep 4
  echo "/useitem mainhand"
  sleep 2
  echo "/inventory 1 click 10"
  sleep 3
  echo "/home home"
  cat
) | ./MinecraftClient K666 - play.amorycraft.com