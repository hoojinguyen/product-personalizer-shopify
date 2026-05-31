import type {
  CartTransformRunInput,
  CartTransformRunResult,
  Operation,
} from "../generated/api";

const NO_CHANGES: CartTransformRunResult = {
  operations: [],
};

export function cartTransformRun(input: CartTransformRunInput): CartTransformRunResult {
  const operations: Operation[] = [];
  const lines = input.cart.lines || [];

  for (const line of lines) {
    const upchargeVal = line.upchargeAmount?.value;
    const previewUrlVal = line.previewUrl?.value;

    if (upchargeVal || previewUrlVal) {
      const basePrice = parseFloat(line.cost.amountPerQuantity.amount) || 0;
      const upchargeAmount = upchargeVal ? parseFloat(upchargeVal) : 0;

      if (upchargeAmount > 0 || previewUrlVal) {
        const newPrice = basePrice + upchargeAmount;

        const lineUpdate: any = {
          cartLineId: line.id,
        };

        if (upchargeAmount > 0) {
          lineUpdate.price = {
            adjustment: {
              fixedPricePerUnit: {
                amount: newPrice.toFixed(2),
              },
            },
          };
        }

        if (previewUrlVal) {
          lineUpdate.image = {
            url: previewUrlVal,
          };
        }

        operations.push({
          lineUpdate,
        } as Operation);
      }
    }
  }

  return operations.length > 0 ? { operations } : NO_CHANGES;
}