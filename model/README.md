# OptiDerma

```bash
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# put your weights next to app.py and name it optiderma_best_model.pth
streamlit run app.py
```

API for the Next.js frontend (`GET /health`, `POST /predict`):
```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```
Env: `OPTIDERMA_WEIGHTS` (weights path), `OPTIDERMA_CORS_ORIGINS` (comma-separated, default `http://localhost:3000`).

Files: app.py, server.py, preprocessor.py, model_pipeline.py, report_generator.py, requirements.txt
