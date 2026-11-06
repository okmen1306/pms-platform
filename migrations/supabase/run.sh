#!/usr/bin/env bash
# Supabase CLI ile migration'ları sırayla uygular. Proje sonunda (Bölüm 16 Go-Live) çalıştırılır.
set -e
supabase migration up
