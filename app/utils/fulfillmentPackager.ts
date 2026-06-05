import { OrderPersonalizationCompiler } from "./orderPersonalizationCompiler";
import { Readable } from "stream";

export interface FulfillmentPackageResult {
  stream: Readable;
  filename: string;
  contentType: string;
}

export class FulfillmentPackagePackager {
  async compile(
    adminOrContext: any,
    orderId?: string,
    options?: any
  ): Promise<FulfillmentPackageResult> {
    let shop: string | undefined;
    let targetOrderId: string;
    let admin: any;

    if (adminOrContext && typeof adminOrContext === "object" && "admin" in adminOrContext && "orderId" in adminOrContext) {
      admin = adminOrContext.admin;
      targetOrderId = adminOrContext.orderId;
      shop = adminOrContext.shop;
    } else {
      admin = adminOrContext;
      targetOrderId = orderId!;
    }

    const compilerOptions: any = {
      adminClient: admin,
      ...options
    };

    const result = await OrderPersonalizationCompiler.packageFulfillment(
      {
        shop: shop || "",
        orderId: targetOrderId
      },
      compilerOptions
    );

    return {
      stream: result.stream,
      filename: result.filename,
      contentType: result.contentType
    };
  }
}
