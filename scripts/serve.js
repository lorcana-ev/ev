#!/usr/bin/env node

/**
 * Simple HTTP server for testing the Lorcana EV application locally
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'text/plain';
}

function serveFile(res, filePath) {
  try {
    const content = readFileSync(filePath);
    const mimeType = getMimeType(filePath);
    
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
    return true;
  } catch (error) {
    return false;
  }
}

const server = createServer((req, res) => {
  let url = req.url;
  
  // Remove query parameters
  url = url.split('?')[0];
  
  // Default to index.html for root
  if (url === '/') {
    url = '/index.html';
  }
  
  // Security: prevent directory traversal
  if (url.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  
  const filePath = join(projectRoot, url.substring(1)); // Remove leading slash
  
  console.log(`${req.method} ${req.url} -> ${filePath}`);
  
  if (existsSync(filePath)) {
    if (serveFile(res, filePath)) {
      return;
    }
  }
  
  // 404 Not Found
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head><title>404 Not Found</title></head>
    <body>
      <h1>404 Not Found</h1>
      <p>The requested file <code>${url}</code> was not found.</p>
      <a href="/">← Back to Home</a>
    </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log(`🚀 Lorcana EV server running at http://localhost:${PORT}`);
  console.log('💡 Press Ctrl+C to stop');
});