import {
  OrderPersonalizationCompiler,
  DefaultDatabaseAdapter,
} from "./orderPersonalizationCompiler";

export interface ShopifyOrderLineItem {
  id: string | number;
  product_id: string | number;
  title: string;
  variant_title?: string | null;
  properties?: Array<{ name: string; value: unknown }> | null;
}

export interface PrintCompileRequest {
  shop: string;
  orderId: string;
  orderName: string;
  lineItem: ShopifyOrderLineItem;
}

export interface PrintCompileResult {
  publicUrl: string;
  filename: string;
  fileBytes: number;
  warnings: string[];
}

export class PrintFileCompilerImpl {
  async compileAndPublish(
    request: PrintCompileRequest,
    adapters: { shopifyClient: any; database: any; network: any }
  ): Promise<PrintCompileResult> {
    const properties = request.lineItem.properties?.map(p => ({
      name: p.name,
      value: p.value
    })) || [];

    const result = await OrderPersonalizationCompiler.compilePrintFiles(
      {
        shop: request.shop,
        orderId: request.orderId
      },
      {
        adminClient: adapters.shopifyClient,
        dbAdapter: adapters.database,
        networkFetcher: adapters.network
      }
    );

    return {
      publicUrl: result.publicUrls[0] || "",
      filename: `print_${request.orderId}_${request.lineItem.id}.svg`,
      fileBytes: 0,
      warnings: result.warnings
    };
  }
}

export interface OrderPrintCompilerResult {
  success: boolean;
  orderId: string;
  processedItemsCount: number;
  warnings: string[];
  publicUrls: string[];
  error?: string;
}

export class OrderPrintCompiler {
  static async compileOrderCore(options: any, logId: string): Promise<OrderPrintCompilerResult> {
    const result = await OrderPersonalizationCompiler.compilePrintFiles(
      {
        shop: options.shop,
        orderId: options.orderId
      },
      {
        adminClient: options.admin,
        dbAdapter: options.db ? new DefaultDatabaseAdapter() : undefined,
        networkFetcher: options.network
      }
    );
    return result;
  }

  static async compileOrder(options: any): Promise<OrderPrintCompilerResult> {
    return OrderPersonalizationCompiler.compilePrintFiles(
      {
        shop: options.shop,
        orderId: options.orderId
      },
      {
        adminClient: options.admin,
        dbAdapter: options.db ? new DefaultDatabaseAdapter() : undefined,
        networkFetcher: options.network
      }
    );
  }

  static async ensureWorkerRunning(adminClient?: any): Promise<void> {
    return OrderPersonalizationCompiler.ensureWorkerRunning(adminClient);
  }

  static async processQueue(adminClient?: any): Promise<void> {
    return OrderPersonalizationCompiler.processQueue({
      adminClient
    });
  }

  static async recoverStuckJobs(): Promise<void> {
    return OrderPersonalizationCompiler.recoverStuckJobs();
  }

  static async enqueueWebhookJob(params: {
    shop: string;
    orderId: string;
    adminClient: any;
    dbClient: any;
  }): Promise<OrderPrintCompilerResult> {
    return OrderPersonalizationCompiler.enqueueWebhookJob(params);
  }
}
