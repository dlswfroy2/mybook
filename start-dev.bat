@echo off
title MyBook Dev Server
cd /d "C:\Users\dhono\.gemini\antigravity\scratch\mybook"
start "" "http://localhost:9005"
npm run dev
pause