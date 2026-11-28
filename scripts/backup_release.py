#!/usr/bin/env python3
"""Backup ZIP reprodutível do código rastreado do ConCiliar+, SEM banco corporativo."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT / "CONCILIAR_PLUS_PROJETO_COMPLETO.zip"
FILELIST=subprocess.check_output(["git","ls-files","-z"],cwd=ROOT).decode("utf-8").split("\0")
BLOCKED={".env","credentials.json","secrets.json","service-account.json","service_role.key"}
def allowed(name: str) -> bool:
    p=Path(name)
    if not name or p.name in BLOCKED or p.name.startswith(".env."): return False
    if any(part in {"node_modules",".git",".homologacao","__pycache__"} for part in p.parts):return False
    if p.suffix.lower() in {".pem",".p12",".pfx",".key"}:return False
    if name.startswith("backups/") or name.startswith("private/"):return False
    return True

items=sorted({name for name in FILELIST if allowed(name) and (ROOT/name).is_file()})
if not items:raise RuntimeError("Nenhum arquivo Git rastreado; ZIP cancelado")
needed={"app.js","index.html","cloud.js","dashboard-bi.js","dashboard-bi-metrics.js","dashboard-bi.css",
        "docs/MANUAL_TECNICO.md","docs/CONTINUIDADE_DO_PROJETO.md","docs/DICIONARIO_DE_INDICADORES.md",
        "CHANGELOG.md","README.md","scripts/backup_release.py"}
missing=needed-set(items)
if missing:raise RuntimeError("Backup incompleto; faltando "+", ".join(sorted(missing)))
commit=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
created=datetime.now(timezone.utc).isoformat()
checksums={}
for name in items:checksums[name]=hashlib.sha256((ROOT/name).read_bytes()).hexdigest()
metadata={
 "product":"ConCiliar+","kind":"source-code-release-backup",
 "commit":commit,"created_at_utc":created,"files":len(items),
 "notes":["Inclui exclusivamente arquivos rastreados no Git, nunca dados corporativos do Supabase.",
          "Segredos e arquivos de ambiente são excluídos.",
          "O backup do workspace corporativo permanece privado na infraestrutura já existente.",
          "Para restaurar, usar o commit e seguir o manual técnico de recuperação."],
 "file_sha256":checksums,
}
with zipfile.ZipFile(OUTPUT,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for name in items:z.write(ROOT/name,arcname=name)
    z.writestr("RELEASE_METADATA.json",json.dumps(metadata,ensure_ascii=False,indent=2))
with zipfile.ZipFile(OUTPUT,"r") as z:
    fail=z.testzip()
    if fail:raise RuntimeError("Arquivo corrompido no ZIP: "+fail)
    names=set(z.namelist())
    if not needed.issubset(names):raise RuntimeError("Arquivos críticos ausentes do ZIP")
    for name in items:
        if hashlib.sha256(z.read(name)).hexdigest()!=checksums[name]:
            raise RuntimeError("Hash divergente em "+name)
print(json.dumps({"file":str(OUTPUT),"commit":commit,"items":len(items),
                  "size_bytes":OUTPUT.stat().st_size,
                  "sha256":hashlib.sha256(OUTPUT.read_bytes()).hexdigest()},ensure_ascii=False))
