"""OptiDerma — clinical skin-lesion decision-support dashboard.
Run:  streamlit run app.py
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import streamlit as st

from model_pipeline import (CLASS_ORDERS, DEFAULT_ORDER, LABEL_NAMES, OptiDermaPipeline,
                            blend_cam, blend_mask, result_to_dict)
from preprocessor import preprocess
from report_generator import DISCLAIMER, build_pdf

st.set_page_config(page_title="OptiDerma", page_icon="🩺", layout="wide")

st.markdown("""
<style>
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px 18px;margin-bottom:12px}
.pill{display:inline-block;padding:3px 10px;border-radius:999px;font-weight:600;font-size:.8rem}
.bar-bg{background:#334155;border-radius:6px;height:14px;width:100%}
.bar-fg{height:14px;border-radius:6px}
.risk{border-radius:12px;padding:14px 18px;color:white;margin-bottom:12px}
.small{color:#94a3b8;font-size:.8rem}
</style>""", unsafe_allow_html=True)

RISK_BG = {"red": "#b91c1c", "amber": "#d97706", "green": "#15803d"}


@st.cache_resource(show_spinner="Loading OptiDerma model…")
def get_pipeline(weights: str) -> OptiDermaPipeline:
    return OptiDermaPipeline(weights)


def find_default_weights() -> str:
    for c in ("optiderma_best_model.pth", "weights/optiderma_best_model.pth", "model.pt", "optiderma_best_model.pt"):
        if Path(c).exists():
            return c
    return "optiderma_best_model.pth"


# ------------------------------- sidebar ---------------------------------- #
with st.sidebar:
    st.title("🩺 OptiDerma")
    st.caption("Clinical AI decision support — investigational")
    weights = st.text_input("Weights file path", find_default_weights())
    order_name = st.selectbox("Class-index order of the 7 logits", list(CLASS_ORDERS), index=list(CLASS_ORDERS).index(DEFAULT_ORDER),
                              help="Must match the label encoding used in training. Wrong order = wrong diagnoses.")
    temperature = st.slider("Softmax temperature", 0.5, 3.0, 1.0, 0.05)
    seg_thr = st.slider("Segmentation threshold", 0.05, 0.95, 0.50, 0.05)
    fov = st.number_input("Image field of view (mm, width)", 5.0, 60.0, 15.0, 0.5,
                          help="Used only to convert pixels → mm². Dermoscopes are typically ~10–20 mm.")
    force = st.checkbox("Analyse even if quality audit fails", value=False)
    patient_id = st.text_input("Patient ID", "ANON-001")

st.title("OptiDerma — Skin Lesion Assessment")
st.markdown(f"<div class='small'>{DISCLAIMER}</div>", unsafe_allow_html=True)

up = st.file_uploader("Upload dermoscopic image", type=["jpg", "jpeg", "png", "bmp", "tif", "tiff"])
if up is None:
    st.info("Upload an image to begin.")
    st.stop()

raw = up.getvalue()
img_bgr = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
if img_bgr is None:
    st.error("Could not decode the image file.")
    st.stop()

# ------------------------------- run pipeline ----------------------------- #
key = hashlib.md5(raw + f"{order_name}{temperature}{seg_thr}{fov}{force}{weights}".encode()).hexdigest()
if st.session_state.get("key") != key:
    pre = preprocess(img_bgr, force=force)
    st.session_state.update(key=key, pre=pre, res=None, ts=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    if pre.tensor is not None:
        if not Path(weights).exists():
            st.error(f"Weights file not found: {weights}")
            st.stop()
        try:
            pipe = get_pipeline(weights)
        except Exception as e:  # noqa: BLE001
            st.error(f"Failed to load weights: {e}")
            st.stop()
        pipe.class_order = CLASS_ORDERS[order_name]
        pipe.temperature = temperature
        with st.spinner("Running inference…"):
            st.session_state["res"] = pipe.predict(pre.tensor, mm_per_px=fov / 256.0, seg_threshold=seg_thr)

pre = st.session_state["pre"]
res = st.session_state["res"]
q = pre.quality
ts = st.session_state["ts"]

# ------------------------------- quality card ----------------------------- #
ok_color = "#15803d" if q.passed else "#b91c1c"
st.markdown(f"""<div class='card'><b>Image Quality Audit</b>
<span class='pill' style='background:{ok_color};margin-left:8px'>{'PASS' if q.passed else 'FAIL'}</span><br>
<span class='small'>Sharpness {q.sharpness:.1f} · Brightness {q.mean_brightness:.1f} · Glare {q.glare_fraction*100:.1f}% ·
Contrast {q.contrast:.1f} · {q.width}×{q.height}px</span></div>""", unsafe_allow_html=True)
for i in q.issues:
    st.error(i)
for a in q.advice:
    st.warning(a)
for w in q.warnings:
    st.info(w)

if res is None:
    st.error("Pipeline halted by the quality gatekeeper. Fix the issues above, or tick "
             "'Analyse even if quality audit fails' in the sidebar.")
    st.stop()

# ------------------------------- risk banner ------------------------------ #
r = res.risk
st.markdown(f"""<div class='risk' style='background:{RISK_BG[r.color]}'>
<b style='font-size:1.15rem'>{r.level.upper()} RISK</b><br>{r.recommendation}</div>""", unsafe_allow_html=True)

left, right = st.columns([3, 2], gap="large")

# ------------------------------- viewer ----------------------------------- #
with left:
    st.subheader("Visual comparison")
    alpha = st.slider("Mask opacity", 0.0, 1.0, 0.4, 0.05)
    t1, t2, t3, t4 = st.tabs(["A · Original", "B · De-haired & corrected", "C · Lesion boundary", "D · Grad-CAM"])
    with t1:
        st.image(pre.original_rgb, use_container_width=True)
    with t2:
        st.image(pre.clean_rgb, use_container_width=True, caption="DullRazor + Shades-of-Gray, 256×256")
    with t3:
        st.image(blend_mask(pre.clean_rgb, res.mask, alpha), use_container_width=True)
    with t4:
        st.image(blend_cam(pre.clean_rgb, res.cam), use_container_width=True,
                 caption=f"Grad-CAM for top-1 class: {LABEL_NAMES[res.top3[0][0]]}")

# ------------------------------- diagnosis -------------------------------- #
with right:
    st.subheader("Top-3 differential")
    html = "<div class='card'>"
    for c, p in res.top3:
        col = "#ef4444" if c in ("mel", "bcc", "akiec") else "#22c55e"
        html += (f"<div style='margin-bottom:10px'><b>{LABEL_NAMES[c]}</b> <span class='small'>({c})</span>"
                 f"<span style='float:right'><b>{p*100:.1f}%</b></span>"
                 f"<div class='bar-bg'><div class='bar-fg' style='width:{p*100:.1f}%;background:{col}'></div></div></div>")
    html += "</div>"
    st.markdown(html, unsafe_allow_html=True)
    if res.malignant_flag:
        st.error(f"Malignant tendency flagged (top-1 = {res.top3[0][0]}). Σ malignant prob = {res.malignant_prob*100:.1f}%")
    else:
        st.success(f"Top-1 is a benign class. Σ malignant prob = {res.malignant_prob*100:.1f}%")

    st.subheader("Morphology")
    m = res.metrics
    c1, c2 = st.columns(2)
    c1.metric("Area (mm², est.)", f"{m.area_mm2:.2f}")
    c2.metric("Perimeter (mm, est.)", f"{m.perimeter_mm:.2f}")
    c1.metric("Asymmetry index", f"{m.asymmetry_index:.3f}")
    c2.metric("Border compactness", f"{m.compactness:.2f}")
    st.caption(f"Lesion covers {m.coverage_pct:.1f}% of frame · top-3 entropy {r.entropy:.2f}")

# ------------------------------- exports ---------------------------------- #
st.subheader("Export")
payload = result_to_dict(res, q.to_dict(), patient_id, ts)
jbytes = json.dumps(payload, indent=2).encode()

buf = io.StringIO()
w = csv.writer(buf)
w.writerow(["session_id", "timestamp", *[f"p_{c}" for c in res.class_order], "top1", "risk",
            "area_mm2", "perimeter_mm", "asymmetry", "compactness"])
w.writerow([patient_id, ts, *[f"{res.probs[c]:.5f}" for c in res.class_order], res.top3[0][0], r.level,
            f"{m.area_mm2:.3f}", f"{m.perimeter_mm:.3f}", f"{m.asymmetry_index:.4f}", f"{m.compactness:.3f}"])

pdf = build_pdf(patient_id, ts, q.to_dict(), res, pre.original_rgb, pre.clean_rgb)
d1, d2, d3 = st.columns(3)
d1.download_button("⬇ PDF report", pdf, f"optiderma_{patient_id}.pdf", "application/pdf", use_container_width=True)
d2.download_button("⬇ JSON (EHR)", jbytes, f"optiderma_{patient_id}.json", "application/json", use_container_width=True)
d3.download_button("⬇ CSV", buf.getvalue().encode(), f"optiderma_{patient_id}.csv", "text/csv", use_container_width=True)
