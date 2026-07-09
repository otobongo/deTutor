#!/usr/bin/env bash
# Downloads the vocabulary source datasets into db/datasets/ (gitignored).
# Run once before npm run ingest:vocab. Idempotent: skips existing files.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p db/datasets

fetch() {
  local url="$1" out="db/datasets/$2"
  if [[ -s $out ]]; then
    echo "exists: $out"
  else
    echo "fetching: $out"
    curl -sL --fail --max-time 300 -o "$out" "$url"
  fi
}

fetch "https://raw.githubusercontent.com/Adityav20/vocabforge-cefr-german/main/data/cefr_vocabulary.csv" cefr_vocabulary.csv
fetch "https://raw.githubusercontent.com/gambolputty/german-nouns/main/german_nouns/nouns.csv" german-nouns.csv
fetch "https://raw.githubusercontent.com/kennethsible/goethe-wortliste/main/sorted.txt" goethe-b1-wortliste.txt
fetch "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt" de-frequency-50k.txt
echo "datasets ready"
