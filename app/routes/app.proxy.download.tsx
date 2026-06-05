import type { LoaderFunctionArgs } from "react-router";
import { FulfillmentPackagePackager } from "../utils/fulfillmentPackager";

// App Proxy dynamic manufacturing ZIP downloader matching ADR 0004
export const loader = ({ request }: LoaderFunctionArgs) => {
  return FulfillmentPackagePackager.downloadResponse(request);
};
