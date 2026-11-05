#!/bin/bash
# Sube el proyecto a GitHub. Ejecutar DESDE DENTRO de la carpeta del proyecto.
set -e
if [ ! -f package.json ] || [ ! -d src ]; then echo "❌ Ejecute este script dentro de la carpeta del proyecto"; exit 1; fi
if [ ! -f .gitignore ]; then echo "❌ Falta .gitignore (protege las claves). Abortando."; exit 1; fi
read -p "URL del repositorio GitHub (privado recomendado): " REPO_URL
[ -z "$REPO_URL" ] && { echo "❌ URL vacía"; exit 1; }
git init
git add .
# Nunca subir secretos ni datos personales
if git ls-files | grep -E '(^|/)\.env($|\.)|\.(csv|xlsx)$' | grep -v '\.env\.example'; then
  echo "❌ Hay archivos con secretos o datos del padrón en el commit. Abortando."; git reset -q; exit 1
fi
git commit -m "Padrón electoral: afiliación PJ, listas, autenticación"
git branch -M main
git remote add origin "$REPO_URL"
git push -u origin main
echo "✅ Subido. Configure las variables en Vercel (ver README)."
