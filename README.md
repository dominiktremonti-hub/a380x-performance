# A380X Takeoff Performance PWA v0.3

Simulator-only iPhone/PWA prototype for FlyByWire A380X.

## v0.3
- SimBrief latest-OFP import by numeric Pilot ID
- Imports departure ICAO, planned takeoff weight, and departure METAR when present
- Automatically loads runway options after SimBrief import
- METAR parser populates wind, OAT and QNH
- Runway and CG remain deliberately pilot-selected/verified
- Offline-capable shell and cached OurAirports runway database
- V1/VR/V2, CONF, THS/FOR, FLEX/TOGA and estimated runway margin

## Important
The performance engine is a heuristic simulator model calibrated around public examples. It is not Airbus-certified data, is not suitable for real-world aviation, and should be cross-checked against SimBrief A388/D8-FBW.

The SimBrief fetcher is called only when the user presses IMPORT LATEST OFP, consistent with SimBrief API usage guidance. The direct browser import requires the SimBrief endpoint to permit the request from the deployed PWA origin; if a host/browser blocks it, manual entry remains available and a small server-side proxy can be added in a hosted version.

Serve this folder over HTTPS (or localhost) to enable service-worker/PWA installation on iOS.
