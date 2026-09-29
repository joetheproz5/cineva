import { handleDownloadRedirect } from "../../shared/admin-dashboard.mjs";

export async function onRequest(context) {
  return handleDownloadRedirect(context.request, context.env, context.params.platform);
}
