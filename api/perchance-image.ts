import { handlePerchanceImageRequest } from './_lib/perchanceHttp.ts';

export const config = {
  maxDuration: 90,
};

export default function handler(
  req: Parameters<typeof handlePerchanceImageRequest>[0],
  res: Parameters<typeof handlePerchanceImageRequest>[1],
) {
  return handlePerchanceImageRequest(req, res);
}
