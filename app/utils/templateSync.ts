import db from "../db.server";
import type { CustomizationOption } from "./configEngine";

export interface TemplateSyncInput {
  id?: string;                   // UUID of the template (optional for creation)
  name?: string;                 // Required for creation
  description?: string | null;
  options?: string;              // JSON options string (optional for updates)
}

export interface SyncProductError {
  productId: string;
  message: string;
}

export interface SyncResult {
  success: boolean;
  templateId: string;
  templateName: string;
  linkedCount: number;
  unlinkedCount: number;
  errors: SyncProductError[];
}

export interface ShopifyMetafieldPayload {
  ownerId: string;
  namespace: string;
  key: string;
  type: "json";
  value: string;
}

export interface ShopifyGraphQLResponse {
  json(): Promise<unknown>;
}

export interface ShopifyAdminClient {
  graphql(query: string, variables?: { variables: Record<string, unknown> }): Promise<ShopifyGraphQLResponse>;
}

/**
 * Port for Shopify Admin operations, allowing easy mocking/stubbing in tests.
 */
export interface ShopifyAdminPort {
  /**
   * Fetch all products in the shop with their App Customization Config metafields.
   */
  fetchProducts(): Promise<Array<{ id: string; configValue: string | null }>>;

  /**
   * Publish multiple metafield values in bulk using standard Shopify Admin mutations.
   */
  publishMetafields(payloads: ShopifyMetafieldPayload[]): Promise<SyncProductError[]>;
}

/**
 * GraphQL Implementation of the Shopify Admin Port.
 */
export class ShopifyAdminGraphQLAdapter implements ShopifyAdminPort {
  constructor(private adminClient: ShopifyAdminClient) {}

  async fetchProducts(): Promise<Array<{ id: string; configValue: string | null }>> {
    const response = await this.adminClient.graphql(
      `#graphql
      query getProductsWithConfigs {
        products(first: 250) {
          edges {
            node {
              id
              metafield(namespace: "app", key: "customization_config") {
                value
              }
            }
          }
        }
      }`
    );
    const json = (await response.json()) as {
      data?: {
        products?: {
          edges?: Array<{
            node: {
              id: string;
              metafield?: {
                value: string;
              };
            };
          }>;
        };
      };
    };
    const edges = json.data?.products?.edges || [];
    return edges.map((edge) => ({
      id: edge.node.id,
      configValue: edge.node.metafield?.value || null,
    }));
  }

  async publishMetafields(payloads: ShopifyMetafieldPayload[]): Promise<SyncProductError[]> {
    if (payloads.length === 0) return [];

    const response = await this.adminClient.graphql(
      `#graphql
      mutation setProductMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafields: payloads as unknown as Record<string, unknown>[],
        },
      }
    );
    const json = (await response.json()) as {
      data?: {
        metafieldsSet?: {
          userErrors?: Array<{
            field?: string[];
            message: string;
          }>;
        };
      };
    };
    const userErrors = json.data?.metafieldsSet?.userErrors || [];
    return userErrors.map((err) => ({
      productId: err.field?.[1] || "unknown",
      message: err.message,
    }));
  }
}

/**
 * Context parameters to automatically resolve dependencies.
 * If only `request` is provided, Shopify credentials are dynamically resolved.
 */
export interface ContextArgs {
  request?: Request;
  admin?: ShopifyAdminClient;
  shop?: string;
  db?: typeof db;
}

export interface PersonalizationConfigInput {
  enabled: boolean;
  templateId?: string;
  layoutMode?: "stacked" | "tabs" | "modal";
  brandColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  heading?: string;
  options: CustomizationOption[];
  upchargeVariantId?: string;
}

/**
 * Helper to resolve database, admin client, and shop domain from incoming arguments.
 */
async function resolveContext(args: ContextArgs) {
  let admin = args.admin;
  let shop = args.shop;
  const dbClient = args.db || db;

  if (args.request && (!admin || !shop)) {
    const { authenticate } = await import("../shopify.server");
    const authResult = await authenticate.admin(args.request);
    admin = authResult.admin as unknown as ShopifyAdminClient;
    shop = authResult.session.shop;
  }

  if (!admin) {
    throw new Error("Shopify Admin Client could not be resolved. Provide either request or admin.");
  }
  if (!shop) {
    throw new Error("Shopify Shop domain could not be resolved. Provide either request or shop.");
  }

  return { admin, shop, db: dbClient };
}

/**
 * PersonalizationConfigSync - High-level consolidated module for template & config synchronization.
 * Designed with a deep interface to keep client calls trivial (zero-boilerplate).
 */
export class PersonalizationConfigSync {
  /**
   * Syncs template state in DB and propagates Personalization Config downstream to target products.
   * Auto-resolves dependencies from ContextArgs.
   */
  static async syncTemplate(
    context: ContextArgs,
    input: TemplateSyncInput,
    targetProductIds: string[]
  ): Promise<SyncResult> {
    const { admin, shop, db: dbClient } = await resolveContext(context);
    const shopifyAdapter = new ShopifyAdminGraphQLAdapter(admin);
    const synchronizer = new TemplateDownstreamSynchronizer(dbClient, shopifyAdapter);
    return synchronizer.sync(shop, input, targetProductIds);
  }

  /**
   * Deletes template in DB and unlinks all downstream products on Shopify.
   * Auto-resolves dependencies from ContextArgs.
   */
  static async unsyncTemplate(
    context: ContextArgs,
    templateId: string
  ): Promise<Omit<SyncResult, "templateId" | "templateName">> {
    const { admin, shop, db: dbClient } = await resolveContext(context);
    const shopifyAdapter = new ShopifyAdminGraphQLAdapter(admin);
    const synchronizer = new TemplateDownstreamSynchronizer(dbClient, shopifyAdapter);
    return synchronizer.unsync(shop, templateId);
  }

  /**
   * Direct-syncs customization config metafield for a single product on Shopify.
   * Auto-resolves dependencies from ContextArgs.
   */
  static async syncProductConfig(
    context: ContextArgs,
    productId: string,
    config: Partial<PersonalizationConfigInput>
  ): Promise<{ success: boolean; errors: SyncProductError[] }> {
    const { admin } = await resolveContext(context);
    const shopifyAdapter = new ShopifyAdminGraphQLAdapter(admin);

    const payload: ShopifyMetafieldPayload = {
      ownerId: productId,
      namespace: "app",
      key: "customization_config",
      type: "json",
      value: JSON.stringify({
        enabled: config.enabled ?? true,
        templateId: config.templateId,
        layoutMode: config.layoutMode || "stacked",
        brandColor: config.brandColor,
        buttonColor: config.buttonColor,
        buttonTextColor: config.buttonTextColor,
        heading: config.heading,
        options: config.options || [],
        upchargeVariantId: config.upchargeVariantId || "",
      }),
    };

    const errors = await shopifyAdapter.publishMetafields([payload]);
    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Direct-syncs personalization configurations for multiple products in bulk.
   * Auto-resolves dependencies from ContextArgs.
   */
  static async syncProductConfigsBulk(
    context: ContextArgs,
    updates: Array<{ productId: string; config: Partial<PersonalizationConfigInput> }>
  ): Promise<{ success: boolean; errors: SyncProductError[] }> {
    const { admin } = await resolveContext(context);
    const shopifyAdapter = new ShopifyAdminGraphQLAdapter(admin);

    const payloads: ShopifyMetafieldPayload[] = updates.map((update) => ({
      ownerId: update.productId,
      namespace: "app",
      key: "customization_config",
      type: "json",
      value: JSON.stringify({
        enabled: update.config.enabled ?? true,
        templateId: update.config.templateId,
        layoutMode: update.config.layoutMode || "stacked",
        brandColor: update.config.brandColor,
        buttonColor: update.config.buttonColor,
        buttonTextColor: update.config.buttonTextColor,
        heading: update.config.heading,
        options: update.config.options || [],
        upchargeVariantId: update.config.upchargeVariantId || "",
      }),
    }));

    const errors = await shopifyAdapter.publishMetafields(payloads);
    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Publishes raw metafield payloads in bulk.
   * Useful for low-level backward-compatible bulk operations.
   */
  static async publishRawMetafields(
    context: ContextArgs,
    payloads: ShopifyMetafieldPayload[]
  ): Promise<SyncProductError[]> {
    const { admin } = await resolveContext(context);
    const shopifyAdapter = new ShopifyAdminGraphQLAdapter(admin);
    return shopifyAdapter.publishMetafields(payloads);
  }
}

/**
 * Classic class keeping core business logic. Hides SQLite queries and metafield calculations.
 * Used internally by PersonalizationConfigSync, or directly if manually injecting dependencies.
 */
export class TemplateDownstreamSynchronizer {
  constructor(private dbClient: typeof db, private shopifyPort: ShopifyAdminPort) {}

  async sync(
    shop: string,
    input: TemplateSyncInput,
    targetProductIds: string[]
  ): Promise<SyncResult> {
    let templateId = input.id;
    let templateName = input.name || "";
    let templateOptions = input.options || "";
    let templateDescription = input.description || "";

    // 1. Create or update Template in local SQLite DB
    if (templateId) {
      const existing = await this.dbClient.template.findFirst({
        where: { id: templateId, shop },
      });
      if (!existing) {
        throw new Error(`Template not found: ${templateId}`);
      }

      templateName = input.name || existing.name;
      templateOptions = input.options || existing.options;
      templateDescription = input.description !== undefined ? (input.description || "") : (existing.description || "");

      await this.dbClient.template.update({
        where: { id: templateId, shop },
        data: {
          name: templateName,
          description: templateDescription,
          options: templateOptions,
        },
      });
    } else {
      if (!input.name) {
        throw new Error("Template name is required for creation");
      }
      if (!input.options) {
        throw new Error("Template options are required for creation");
      }
      const created = await this.dbClient.template.create({
        data: {
          shop,
          name: templateName,
          description: templateDescription,
          options: templateOptions,
        },
      });
      templateId = created.id;
    }

    // 2. Fetch current storefront products to detect active configurations
    const products = await this.shopifyPort.fetchProducts();

    // Compute currently linked products
    const currentlyLinkedIds: string[] = [];
    products.forEach((p) => {
      if (p.configValue) {
        try {
          const config = JSON.parse(p.configValue);
          if (config.templateId === templateId) {
            currentlyLinkedIds.push(p.id);
          }
        } catch (e) {
          // Ignore parse errors on invalid metafield formats
        }
      }
    });

    const toUnlink = currentlyLinkedIds.filter((id) => !targetProductIds.includes(id));

    // 3. Assemble metafield mutation payloads
    const parsedOptions = JSON.parse(templateOptions || "{}");
    const personalizationConfig = {
      enabled: true,
      templateId: templateId,
      layoutMode: parsedOptions.layoutMode || "stacked",
      brandColor: parsedOptions.brandColor || "#008060",
      buttonColor: parsedOptions.buttonColor || "#008060",
      buttonTextColor: parsedOptions.buttonTextColor || "#ffffff",
      heading: parsedOptions.heading || "Personalize Your Item",
      options: parsedOptions.options || [],
    };

    const payloads: ShopifyMetafieldPayload[] = [];

    // Link/update products
    targetProductIds.forEach((productId) => {
      payloads.push({
        ownerId: productId,
        namespace: "app",
        key: "customization_config",
        type: "json",
        value: JSON.stringify(personalizationConfig),
      });
    });

    // Unlink products
    toUnlink.forEach((productId) => {
      payloads.push({
        ownerId: productId,
        namespace: "app",
        key: "customization_config",
        type: "json",
        value: JSON.stringify({ enabled: false, options: [] }),
      });
    });

    // 4. Publish mutations in bulk
    const errors = await this.shopifyPort.publishMetafields(payloads);

    return {
      success: errors.length === 0,
      templateId: templateId!,
      templateName,
      linkedCount: targetProductIds.length,
      unlinkedCount: toUnlink.length,
      errors,
    };
  }

  async unsync(shop: string, templateId: string): Promise<Omit<SyncResult, "templateId" | "templateName">> {
    const products = await this.shopifyPort.fetchProducts();

    const currentlyLinkedIds: string[] = [];
    products.forEach((p) => {
      if (p.configValue) {
        try {
          const config = JSON.parse(p.configValue);
          if (config.templateId === templateId) {
            currentlyLinkedIds.push(p.id);
          }
        } catch (e) {
          // Ignore
        }
      }
    });

    const payloads: ShopifyMetafieldPayload[] = currentlyLinkedIds.map((productId) => ({
      ownerId: productId,
      namespace: "app",
      key: "customization_config",
      type: "json",
      value: JSON.stringify({ enabled: false, options: [] }),
    }));

    const errors = await this.shopifyPort.publishMetafields(payloads);

    await this.dbClient.template.delete({
      where: { id: templateId, shop },
    });

    return {
      success: errors.length === 0,
      linkedCount: 0,
      unlinkedCount: currentlyLinkedIds.length,
      errors,
    };
  }
}
