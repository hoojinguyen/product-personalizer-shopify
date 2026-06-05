export interface ConditionalRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "checked" | "unchecked";
  value: string;
}

export interface CustomizationOption {
  id: string;
  type: "text" | "textarea" | "select" | "swatch" | "file" | "checkbox" | "clipart" | "font" | "number" | "info";
  label: string;
  required: boolean;
  priceUpcharge: number;
  placeholder?: string;
  defaultValue?: string;
  maxChars?: number;
  choices?: string;
  choicesType?: "custom" | "global";
  assetSetId?: string;
  conditionalRules?: ConditionalRule[];
  description?: string;
  caseConstraint?: "uppercase" | "lowercase" | "normal";
  allowedSymbols?: string;
  allowShopperColor?: boolean;
  linkedColorSetId?: string;
  
  // Coordinate positioning attributes (800x800 logical coordinate matrix)
  canvasX?: number;
  canvasY?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  canvasRotation?: number;
  canvasFontSize?: number;
}

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

export interface ResolvedCustomizer {
  visibleOptions: CustomizationOption[];
  resolvedValues: Record<string, unknown>;
  totalUpcharge: number;
  layoutNodes: LayoutNode[];
}

/**
 * Core Personalization Configuration class model.
 * Hides all option parsing, default fallbacks, visibility rules, and upcharge calculations.
 */
export class PersonalizationConfig {
  constructor(
    public readonly options: CustomizationOption[],
    public readonly upchargeVariantId: string = "",
    public readonly enabled: boolean = true
  ) {}

  /**
   * Safely resolves and parses a product's metafield configuration, falling back to a self-healing default.
   */
  static fromMetafield(metafieldValue: string | undefined | null): PersonalizationConfig {
    const defaultOption: CustomizationOption = {
      id: "opt-default-text",
      type: "text",
      label: "Engraving Text",
      required: true,
      priceUpcharge: 0.0,
      maxChars: 30,
      placeholder: "Enter text to engrave",
      canvasX: 400,
      canvasY: 400,
      canvasFontSize: 48,
      canvasWidth: 250,
      canvasHeight: 250,
      canvasRotation: 0
    };

    if (!metafieldValue) {
      return new PersonalizationConfig([defaultOption], "", false);
    }

    try {
      const config = JSON.parse(metafieldValue);
      return new PersonalizationConfig(
        config.options && config.options.length > 0 ? config.options : [defaultOption],
        config.upchargeVariantId || "",
        config.enabled ?? false
      );
    } catch (e) {
      return new PersonalizationConfig([defaultOption], "", false);
    }
  }

  /**
   * Resolves options, values, upcharges, and visual tree layout nodes in a single pass.
   */
  resolve(shopperValues: Record<string, unknown>): ResolvedCustomizer {
    const visibleOptions = this.getVisibleOptions(shopperValues);
    const resolvedValues: Record<string, unknown> = {};

    visibleOptions.forEach((opt) => {
      resolvedValues[opt.id] = this.resolveOptionValue(opt, shopperValues);
    });

    const totalUpcharge = this.calculateTotalUpcharges(shopperValues);
    const layoutNodes: LayoutNode[] = [];

    visibleOptions.forEach((opt) => {
      const val = resolvedValues[opt.id];
      const cx = opt.canvasX ?? 400;
      const cy = opt.canvasY ?? 400;
      const rot = opt.canvasRotation ?? 0;

      if (opt.type === "text" || opt.type === "textarea") {
        // Resolve active typography style font & color
        let activeFont = "Arial";
        let activeColor = "#000000";

        // Find font configuration
        const fontOption = this.options.find((o) => o.type === "font");
        if (fontOption) {
          const fVal = this.resolveOptionValue(fontOption, shopperValues);
          if (fVal) activeFont = String(fVal);
        } else {
          // Fallback: search by label
          const labelFontOpt = this.options.find(
            (o) => o.label.toLowerCase().includes("font") || o.label.toLowerCase().includes("style")
          );
          if (labelFontOpt) {
            const fVal = this.resolveOptionValue(labelFontOpt, shopperValues);
            if (fVal) activeFont = String(fVal);
          }
        }

        // Find color configuration
        const swatchOption = this.options.find((o) => o.type === "swatch");
        if (swatchOption) {
          const sVal = this.resolveOptionValue(swatchOption, shopperValues);
          if (sVal) activeColor = String(sVal);
        } else {
          // Fallback: check label containing color
          const labelColorOpt = this.options.find((o) => o.label.toLowerCase().includes("color"));
          if (labelColorOpt) {
            const sVal = this.resolveOptionValue(labelColorOpt, shopperValues);
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

        layoutNodes.push({
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
      } else if (opt.type === "clipart" || opt.type === "file") {
        layoutNodes.push({
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

    return {
      visibleOptions,
      resolvedValues,
      totalUpcharge,
      layoutNodes,
    };
  }

  /**
   * Resolves an option value from the shopper values dictionary, checking by ID first and falling back to Label.
   */
  resolveOptionValue(
    opt: CustomizationOption,
    shopperValues: Record<string, any>
  ): unknown {
    return shopperValues[opt.id] !== undefined ? shopperValues[opt.id] : shopperValues[opt.label];
  }

  /**
   * Evaluates conditional visibility for a customization option based on current selections.
   */
  isOptionVisible(
    opt: CustomizationOption,
    shopperValues: Record<string, any>
  ): boolean {
    if (!opt.conditionalRules || opt.conditionalRules.length === 0) return true;

    return opt.conditionalRules.every(rule => {
      if (!rule.fieldId) return true;

      let val: any = undefined;
      // Find the trigger option in options list to resolve by ID or label
      const triggerOpt = this.options.find(o => o.id === rule.fieldId);
      if (triggerOpt) {
        val = this.resolveOptionValue(triggerOpt, shopperValues);
      } else {
        val = shopperValues[rule.fieldId];
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
   * Calculates the total upcharges for all currently visible options based on selections.
   */
  calculateTotalUpcharges(shopperValues: Record<string, any>): number {
    let sum = 0;
    this.options.forEach(opt => {
      if (this.isOptionVisible(opt, shopperValues) && opt.priceUpcharge > 0) {
        const val = shopperValues[opt.id] !== undefined ? shopperValues[opt.id] : shopperValues[opt.label];
        if (val !== undefined && val !== null && val !== "") {
          if (opt.type === "checkbox") {
            const stringVal = String(val).toLowerCase();
            if (val === true || stringVal === "true" || stringVal === "yes") {
              sum += opt.priceUpcharge;
            }
          } else {
            // Strings or other choice values
            if (typeof val === "string" && val.trim() !== "") {
              sum += opt.priceUpcharge;
            } else if (typeof val !== "string") {
              sum += opt.priceUpcharge;
            }
          }
        }
      }
    });
    return sum;
  }

  /**
   * Filters the options to return only those that are visible given the current selections.
   */
  getVisibleOptions(shopperValues: Record<string, any>): CustomizationOption[] {
    return this.options.filter(opt => this.isOptionVisible(opt, shopperValues));
  }
}
