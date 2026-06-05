import type { CustomizationOption } from "./configEngine";

export interface LayoutNode {
  id: string;
  type: "text" | "textarea" | "select" | "swatch" | "file" | "checkbox" | "clipart" | "font" | "number" | "info";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  text?: string;
  imageUrl?: string;
}

/**
 * Resolves an option value from the shopper values dictionary, checking by ID first and falling back to Label.
 */
export function resolveOptionValue(opt: CustomizationOption, values: Record<string, unknown>): unknown {
  return values[opt.id] !== undefined ? values[opt.id] : values[opt.label];
}

/**
 * Evaluates conditional visibility rules for a customization option, supporting ID and Label lookups.
 */
export function isOptionVisible(
  opt: CustomizationOption,
  values: Record<string, unknown>,
  options: CustomizationOption[]
): boolean {
  if (!opt.conditionalRules || opt.conditionalRules.length === 0) return true;

  return opt.conditionalRules.every((rule) => {
    if (!rule.fieldId) return true;

    // Find the trigger option in options list to resolve by ID or label
    const triggerOpt = options.find((o) => o.id === rule.fieldId);
    let val: unknown = undefined;
    if (triggerOpt) {
      val = resolveOptionValue(triggerOpt, values);
    } else {
      val = values[rule.fieldId];
    }

    const stringVal = val === undefined || val === null ? "" : String(val).trim();

    if (rule.operator === "checked") {
      return val === true || stringVal === "true" || stringVal.toLowerCase() === "yes";
    }
    if (rule.operator === "unchecked") {
      return !val || val === false || stringVal === "false" || stringVal === "";
    }
    if (rule.operator === "equals") {
      return stringVal === String(rule.value || "").trim();
    }
    if (rule.operator === "not_equals") {
      return stringVal !== String(rule.value || "").trim();
    }
    return true;
  });
}

/**
 * High-leverage Layout Engine.
 * Compiles option configurations and shopper selections into a device-agnostic Visual Tree of layout nodes.
 */
export class PersonalizationLayoutEngine {
  static compileLayout(
    options: CustomizationOption[],
    shopperValues: Record<string, unknown>
  ): LayoutNode[] {
    const nodes: LayoutNode[] = [];

    options.forEach((opt) => {
      // 1. Evaluate Option Visibility
      if (!isOptionVisible(opt, shopperValues, options)) {
        return;
      }

      // 2. Resolve Selection Value
      const val = resolveOptionValue(opt, shopperValues);
      const cx = opt.canvasX ?? 400;
      const cy = opt.canvasY ?? 400;
      const rot = opt.canvasRotation ?? 0;

      if (opt.type === "text" || opt.type === "textarea") {
        // Resolve active typography style font & color
        let activeFont = "Arial";
        let activeColor = "#000000";

        // Find font configuration
        const fontOption = options.find((o) => o.type === "font");
        if (fontOption) {
          const fVal = resolveOptionValue(fontOption, shopperValues);
          if (fVal) activeFont = String(fVal);
        } else {
          // Fallback: search by label
          const labelFontOpt = options.find(
            (o) => o.label.toLowerCase().includes("font") || o.label.toLowerCase().includes("style")
          );
          if (labelFontOpt) {
            const fVal = resolveOptionValue(labelFontOpt, shopperValues);
            if (fVal) activeFont = String(fVal);
          }
        }

        // Find color configuration
        const swatchOption = options.find((o) => o.type === "swatch");
        if (swatchOption) {
          const sVal = resolveOptionValue(swatchOption, shopperValues);
          if (sVal) activeColor = String(sVal);
        } else {
          // Fallback: check label containing color
          const labelColorOpt = options.find((o) => o.label.toLowerCase().includes("color"));
          if (labelColorOpt) {
            const sVal = resolveOptionValue(labelColorOpt, shopperValues);
            if (sVal) activeColor = String(sVal);
          } else if (shopperValues[`${opt.id}_color`]) {
            activeColor = String(shopperValues[`${opt.id}_color`]);
          } else if (opt.choices) {
            activeColor = opt.choices.split(",")[0]?.trim() || "#000000";
          }
        }

        let shopperText = val !== undefined && val !== null && val !== "" ? String(val) : (opt.defaultValue !== undefined ? opt.defaultValue : opt.label);
        if (opt.caseConstraint === "uppercase") shopperText = shopperText.toUpperCase();
        if (opt.caseConstraint === "lowercase") shopperText = shopperText.toLowerCase();

        nodes.push({
          id: opt.id,
          type: opt.type,
          label: opt.label,
          x: cx,
          y: cy,
          width: 0, // Calculated dynamically by rendering adapters
          height: opt.canvasFontSize ?? 48,
          rotation: rot,
          color: activeColor,
          fontFamily: activeFont,
          fontSize: opt.canvasFontSize ?? 48,
          text: shopperText,
        });
      } else if (opt.type === "clipart") {
        nodes.push({
          id: opt.id,
          type: opt.type,
          label: opt.label,
          x: cx,
          y: cy,
          width: opt.canvasWidth ?? 250,
          height: opt.canvasHeight ?? 250,
          rotation: rot,
          imageUrl: val ? String(val) : undefined,
        });
      } else if (opt.type === "file") {
        nodes.push({
          id: opt.id,
          type: opt.type,
          label: opt.label,
          x: cx,
          y: cy,
          width: opt.canvasWidth ?? 250,
          height: opt.canvasHeight ?? 250,
          rotation: rot,
          imageUrl: val ? String(val) : undefined,
        });
      }
    });

    return nodes;
  }
}
