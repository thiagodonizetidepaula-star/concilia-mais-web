# DocFlow AI — piloto protegido

Aplicativo Streamlit em Python para testar a classificação de PDFs por cliente, tipo e competência. Esta etapa não está conectada ao Outlook, OneDrive ou Supabase.

## Iniciar

Instalar: `pip install -r docflow_piloto/requirements.txt`

Definir variável `DOCFLOW_ACCESS_PASSWORD` para uma senha privada e iniciar: `streamlit run docflow_piloto/app.py`

## Limitações

- Não faz OCR em PDFs escaneados.
- Não envia arquivos ao OneDrive nem acessa e-mails.
- Não persiste PDFs, resultados ou clientes fora da sessão.
- Nenhum arquivo corporativo deve ser enviado durante o piloto.
- A pasta `DOCFLOW_TESTE` é apenas um destino sugerido, não criada nesta versão.
- O aplicativo deve ser acessado via HTTPS e senha; nunca commitar credenciais.

## Isolamento

A branch `docflow-ai-piloto` é destinada exclusivamente ao novo serviço Render DocFlow, sem alterações na branch principal do Concilia+.
