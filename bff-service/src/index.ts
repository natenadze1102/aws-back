import http from 'http';
import url from 'url';
import { config } from 'dotenv';
import { makeRequest } from './utils/http-client';
import { cacheManager } from './utils/cache-manager';

// Load environment variables
config();

const PORT = process.env.PORT || 3000;

// Map service names to their URLs from environment variables
const SERVICE_URLS: Record<string, string | undefined> = {
  product: process.env.PRODUCT_SERVICE_URL,
  cart: process.env.CART_SERVICE_URL
};

const server = http.createServer(async (req, res) => {
  try {
    // Parse URL
    const parsedUrl = url.parse(req.url || '', true);
    const pathSegments = parsedUrl.pathname?.split('/').filter(Boolean) || [];
    
    // First path segment should be the service name
    const serviceName = pathSegments[0]?.toLowerCase();
    
    if (!serviceName) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Service name is required' }));
      return;
    }
    
    // Get service URL from environment variables
    const serviceUrl = SERVICE_URLS[serviceName];
    
    if (!serviceUrl) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'Cannot process request' }));
      return;
    }
    
    // Reconstruct the path without the service name
    const remainingPath = '/' + pathSegments.slice(1).join('/');
    
    // Reconstruct the target URL with query string
    const targetUrl = `${serviceUrl}${remainingPath}${
      parsedUrl.search || ''
    }`;
    
    // Special case for product list with caching
    if (
      serviceName === 'product' && 
      req.method === 'GET' && 
      (remainingPath === '/' || remainingPath === '/products')
    ) {
      const cachedResponse = cacheManager.get('productsList');
      if (cachedResponse) {
        console.log('Returning cached product list');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cachedResponse));
        return;
      }
    }
    
    // Forward the request
    console.log(`Forwarding ${req.method} request to: ${targetUrl}`);
    
    let requestBody: any = '';
    
    // Collect request body if present
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.on('data', (chunk) => {
        requestBody += chunk.toString();
      });
      
      await new Promise<void>((resolve) => {
        req.on('end', () => {
          resolve();
        });
      });
      
      try {
        requestBody = JSON.parse(requestBody);
      } catch (e) {
        // If it's not JSON, keep it as is
      }
    }
    
    // Clone headers but exclude host
    const headers: Record<string, string> = {};
    Object.entries(req.headers).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'host' && value) {
        headers[key] = Array.isArray(value) ? value[0] : value;
      }
    });
    
    try {
      const response = await makeRequest(targetUrl, {
        method: req.method || 'GET',
        headers,
        data: requestBody || undefined,
      });
      
      // Cache product list response
      if (
        serviceName === 'product' && 
        req.method === 'GET' && 
        (remainingPath === '/' || remainingPath === '/products')
      ) {
        cacheManager.set('productsList', response.data);
      }
      
      // Forward response headers
      Object.entries(response.headers).forEach(([key, value]) => {
        if (value) {
          res.setHeader(key, value);
        }
      });
      
      res.writeHead(response.status);
      res.end(typeof response.data === 'object' ? JSON.stringify(response.data) : response.data);
    } catch (error: any) {
      console.error('Error forwarding request:', error.message);
      
      // Forward error status and response
      const status = error.response?.status || 502;
      const errorData = error.response?.data || { error: 'Cannot process request' };
      
      res.writeHead(status);
      res.end(typeof errorData === 'object' ? JSON.stringify(errorData) : errorData);
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`BFF Service running on port ${PORT}`);
  console.log('Service URLs:');
  Object.entries(SERVICE_URLS).forEach(([name, url]) => {
    console.log(`- ${name}: ${url || 'Not configured'}`);
  });
});
