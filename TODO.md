# AquaGuard — Team TODO

## Completed
- [x] Project scaffolding (backend, model, frontend)
- [x] FastAPI backend with .inp upload endpoint
- [x] WNTR network parser
- [x] Data pipeline (hydraulic sim + synthetic leak generation)
- [x] Graph builder (NetworkX + PyG Data objects)
- [x] React dashboard with network map + stats panel
- [x] Root-level `pnpm dev` to start both services
- [x] Simple auth (placeholder for Auth0)
- [x] UI cleanup

---

## Yug — Backend & Infrastructure
- [ ] `/api/detect` endpoint — wire up detection pipeline
- [ ] `/api/simulate` endpoint — leak injection for sandbox
- [ ] `/api/dispatch/{leak_id}` — ElevenLabs voice generation
- [ ] WebSocket support for real-time heatmap updates
- [ ] Auth0 integration (future)

## Joseph — Model & ML Pipeline
- [ ] Pairwise regression detector (sensor-pair correlation breaks)
- [ ] GraphSAGE autoencoder (encoder + decoder)
- [ ] Feature engineering (pressure residuals, flow-pressure ratio, rolling stats)
- [ ] CUSUM detector on reconstruction residuals
- [ ] Weighted triangulation (refine heatmap to pinpoint coordinates)
- [ ] Composite anomaly scoring (GNN + pairwise + CUSUM)
- [ ] Training loop + evaluation on L-TOWN
- [ ] Leak classification (burst / degradation / joint failure)
- [ ] Severity estimation (back-calculate leak rate)
- [ ] Heatmap generation with tiered alert zones

## Anthony — Frontend & Dashboard
- [ ] Heatmap visualization layer on network map
- [ ] Leak intelligence panel (severity, type, confidence, location)
- [ ] Economics panel (daily loss, cost, CO₂, ROI)
- [ ] Detection timeline with heatmap replay
- [ ] City Sandbox page
- [ ] Savings calculator page
- [ ] ElevenLabs voice dispatch button

---

## Future / Stretch Goals
- [ ] Auth0 full integration
- [ ] Procedural .inp generation for City Sandbox
- [ ] Downstream impact analysis (graph traversal)
- [ ] Temporal forensics (onset, growth trend, projected cost)
- [ ] Per-leak economic calculations
- [ ] README + documentation
