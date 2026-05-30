import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received GDPR compliance ${topic} webhook for ${shop}`);

  // In a real app, you would fetch customer data and send it to the customer/merchant.
  // For the MVP, we log the request and return 200 OK as required by Shopify.

  return new Response();
};
