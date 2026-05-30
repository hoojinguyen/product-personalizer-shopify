import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received GDPR compliance ${topic} webhook for ${shop}`);

  // In a real app, you would delete all store-related data from your databases.
  // For the MVP, we log the request and return 200 OK.

  return new Response();
};
