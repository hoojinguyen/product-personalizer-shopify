# Unified Canvas Rendering

## Context

Our Shopify personalization app needs to provide consistent WYSIWYG rendering across the storefront preview (Vanilla JS theme extension), the admin dashboard template builder (React), and the manufacturing print-file generator (Node.js webhook). Maintaining separate custom canvas drawing scripts and raw XML SVG templates leads to differences in font scaling, text placement, and clipping, causing production defects in manufactured goods.

## Decision

We will use a Unified Canvas Rendering model. A shared rendering utility module will accept a unified JSON **Personalization Config** and draw elements consistently. 

* The admin template editor renders this layout in a React wrapper.
* The storefront customizer renders it dynamically in a vanilla HTML5 canvas.
* The order processing webhook compiles a headless vector SVG generator routine (converting choices, typography, overlays, and coordinates into infinitely scalable XML vectors) to output a high-resolution, print-ready file.

This establishes absolute parity between what the customer sees and what the merchant manufactures.
