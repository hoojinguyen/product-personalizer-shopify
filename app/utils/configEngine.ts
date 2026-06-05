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

/**
 * Resolves an option value from the shopper values dictionary, checking by ID first and falling back to Label.
 */
export function resolveOptionValue(
  opt: CustomizationOption,
  values: Record<string, any>
): unknown {
  return values[opt.id] !== undefined ? values[opt.id] : values[opt.label];
}

/**
 * Evaluates conditional visibility for a customization option based on current selections.
 * Supports both ID and Label-based lookups when the full options list is provided.
 */
export function isOptionVisible(
  opt: CustomizationOption,
  shopperValues: Record<string, any>,
  options?: CustomizationOption[]
): boolean {
  if (!opt.conditionalRules || opt.conditionalRules.length === 0) return true;
  
  return opt.conditionalRules.every(rule => {
    if (!rule.fieldId) return true;
    
    let val: any = undefined;
    if (options) {
      // Find the trigger option in options list to resolve by ID or label
      const triggerOpt = options.find(o => o.id === rule.fieldId);
      if (triggerOpt) {
        val = resolveOptionValue(triggerOpt, shopperValues);
      } else {
        val = shopperValues[rule.fieldId];
      }
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
export function calculateTotalUpcharges(
  options: CustomizationOption[],
  shopperValues: Record<string, any>
): number {
  let sum = 0;
  options.forEach(opt => {
    if (isOptionVisible(opt, shopperValues, options) && opt.priceUpcharge > 0) {
      const val = shopperValues[opt.id];
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
 * Safely resolves and parses a product's metafield configuration, falling back to a self-healing default.
 */
export function resolveConfigDefaults(
  metafieldValue: string | undefined | null
): { enabled: boolean; options: CustomizationOption[]; upchargeVariantId: string } {
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
    return {
      enabled: false,
      options: [defaultOption],
      upchargeVariantId: ""
    };
  }

  try {
    const config = JSON.parse(metafieldValue);
    return {
      enabled: config.enabled ?? false,
      options: config.options && config.options.length > 0 ? config.options : [defaultOption],
      upchargeVariantId: config.upchargeVariantId || ""
    };
  } catch (e) {
    return {
      enabled: false,
      options: [defaultOption],
      upchargeVariantId: ""
    };
  }
}
