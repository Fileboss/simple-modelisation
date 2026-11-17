---
title: Zone membership is geometric
tags: [adr]
date: 2026-11-17
status: accepted
---

# Zone membership is geometric

A Zone stores only its name, place and size; nothing on a Component says which Zone it belongs to. An element belongs to the innermost Zone its box lies wholly in, computed when needed (moving a Zone, Tidy up, MCP reads) by one function of the model package, always at the sizes the model estimates for Components, so that the canvas, Tidy up and agents agree on what a Zone holds even where the drawn size differs a little. A stored parent link (React Flow's sub-flows) was the alternative: it lets a Zone own content that sticks out, but two Participants moving a Component and its Zone at once could leave a parent link that no longer matches the drawing, and every move would have to keep the links in step. With geometry, what you see is what it means. The cost: an element dropped by accident inside a Zone joins it, and a growing Zone can take in its neighbours, which the MCP tools avoid by pushing what lies across or beyond a growing edge.
