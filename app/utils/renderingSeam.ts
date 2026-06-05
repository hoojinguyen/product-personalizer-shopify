import type { LayoutNode } from "./configEngine";

/**
 * Port interface for visual layout rendering.
 * Establishes a standard layout canvas contract that both HTML5 Canvas
 * and Vector SVG compiler adapters satisfy.
 */
export interface VisualLayoutRenderer {
  renderText(node: LayoutNode): void | Promise<void>;
  renderClipart(node: LayoutNode): void | Promise<void>;
  renderFile(node: LayoutNode): void | Promise<void>;
}

/**
 * Deep module that manages the visual layout structure and coordinates
 * drawing execution.
 */
export class LayoutTree {
  constructor(public readonly nodes: LayoutNode[]) {}

  /**
   * Executes the rendering loop across the visual seam.
   */
  renderAll(renderer: VisualLayoutRenderer): void {
    this.nodes.forEach((node) => {
      if (node.type === "text" || node.type === "textarea") {
        renderer.renderText(node);
      } else if (node.type === "clipart") {
        renderer.renderClipart(node);
      } else if (node.type === "file") {
        renderer.renderFile(node);
      }
    });
  }

  /**
   * Executes the rendering loop asynchronously across the visual seam.
   */
  async renderAllAsync(renderer: VisualLayoutRenderer): Promise<void> {
    for (const node of this.nodes) {
      if (node.type === "text" || node.type === "textarea") {
        await renderer.renderText(node);
      } else if (node.type === "clipart") {
        await renderer.renderClipart(node);
      } else if (node.type === "file") {
        await renderer.renderFile(node);
      }
    }
  }
}
