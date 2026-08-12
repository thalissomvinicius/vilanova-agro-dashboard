import { randomUUID } from 'node:crypto';

function firstHeaderValue(value) {
  const text = Array.isArray(value) ? value[0] : value;
  return String(text || '').split(',')[0].trim();
}

export function clientIpFromRequest(request) {
  const forwardedIp = firstHeaderValue(
    request?.headers?.['x-vercel-forwarded-for']
      || request?.headers?.['x-forwarded-for']
      || request?.headers?.['x-real-ip']
  );
  const socketIp = firstHeaderValue(request?.socket?.remoteAddress);
  return (forwardedIp || socketIp || '').replace(/^::ffff:/, '');
}

export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).end();
    return;
  }

  const serverTimestamp = new Date().toISOString();
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(200).json({
    ip: clientIpFromRequest(request),
    timestamp: serverTimestamp,
    serverTimestamp,
    requestId: randomUUID(),
  });
}
