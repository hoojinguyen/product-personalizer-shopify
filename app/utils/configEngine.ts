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
   * Filters the options to return only those that are visible given the current selections.
   */
  getVisibleOptions(shopperValues: Record<string, any>): CustomizationOption[] {
    return this.options.filter(opt => this.isOptionVisible(opt, shopperValues));
  }
}

/**
 * Resolves an option value from the shopper values dictionary, checking by ID first and falling back to Label.
 * @deprecated Use PersonalizationConfig instance method instead.
 */
export function resolveOptionValue(
  opt: CustomizationOption,
  values: Record<string, any>
): unknown {
  const config = new PersonalizationConfig([]);
  return config.resolveOptionValue(opt, values);
}

/**
 * Evaluates conditional visibility for a customization option based on current selections.
 * @deprecated Use PersonalizationConfig instance method instead.
 */
export function isOptionVisible(
  opt: CustomizationOption,
  shopperValues: Record<string, any>,
  options?: CustomizationOption[]
): boolean {
  const config = new PersonalizationConfig(options || []);
  return config.isOptionVisible(opt, shopperValues);
}

/**
 * Calculates the total upcharges for all currently visible options based on selections.
 * @deprecated Use PersonalizationConfig instance method instead.
 */
export function calculateTotalUpcharges(
  options: CustomizationOption[],
  shopperValues: Record<string, any>
): number {
  const config = new PersonalizationConfig(options);
  return config.calculateTotalUpcharges(shopperValues);
}

/**
 * Safely resolves and parses a product's metafield configuration, falling back to a self-healing default.
 * @deprecated Use PersonalizationConfig.fromMetafield instead.
 */
export function resolveConfigDefaults(
  metafieldValue: string | undefined | null
): { enabled: boolean; options: CustomizationOption[]; upchargeVariantId: string } {
  const config = PersonalizationConfig.fromMetafield(metafieldValue);
  return {
    enabled: config.enabled,
    options: config.options,
    upchargeVariantId: config.upchargeVariantId
  };
}
