import fastify from 'fastify';
import { createAvatar } from '@dicebear/core';
import * as collection from '@dicebear/collection';

const app = fastify({
  logger: true,
});

// Add CORS headers using onSend hook as requested
app.addHook('onSend', (request, reply, payload, done) => {
  const origin = request.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000', // For development
    'http://localhost:5173'  // For Vite dev server
  ];
  
  // Check if origin is allowed (either in allowedOrigins or a subdomain of extndly.com)
  let isAllowed = false;
  
  if (origin) {
    // Check exact matches first
    if (allowedOrigins.includes(origin)) {
      isAllowed = true;
    } else {
      // Check if it's extndly.com or any subdomain of extndly.com
      try {
        const url = new URL(origin);
        if (url.hostname === 'extndly.com' || url.hostname.endsWith('.extndly.com')) {
          isAllowed = true;
        }
      } catch (error) {
        // Invalid URL, not allowed
        isAllowed = false;
      }
    }
  }
  
  if (isAllowed) {
    reply.header('Access-Control-Allow-Origin', origin);
  }
  
  reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
  reply.header('Access-Control-Allow-Credentials', 'false');
  done();
});

// Handle preflight OPTIONS requests
app.options('*', async (request, reply) => {
  const origin = request.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000', // For development
    'http://localhost:5173'  // For Vite dev server
  ];
  
  // Check if origin is allowed (either in allowedOrigins or a subdomain of extndly.com)
  let isAllowed = false;
  
  if (origin) {
    // Check exact matches first
    if (allowedOrigins.includes(origin)) {
      isAllowed = true;
    } else {
      // Check if it's extndly.com or any subdomain of extndly.com
      try {
        const url = new URL(origin);
        if (url.hostname === 'extndly.com' || url.hostname.endsWith('.extndly.com')) {
          isAllowed = true;
        }
      } catch (error) {
        // Invalid URL, not allowed
        isAllowed = false;
      }
    }
  }
  
  if (isAllowed) {
    reply.header('Access-Control-Allow-Origin', origin);
  }
  
  reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
  reply.header('Access-Control-Allow-Credentials', 'false');
  reply.status(200).send();
});

// Health check endpoint
app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Avatar generation endpoint
app.get('/:version/:style/:format', async (request, reply) => {
  const { version, style, format } = request.params as {
    version: string;
    style: string;
    format: string;
  };

  try {
    // Get the style from the collection
    const styleModule = (collection as any)[style];
    
    if (!styleModule) {
      reply.status(404).send({ error: 'Style not found' });
      return;
    }

    // Get query parameters for avatar options
    const options = request.query as Record<string, any>;
    
    // Create the avatar
    const avatar = createAvatar(styleModule, options);
    
    // Return the appropriate format
    if (format === 'svg') {
      reply.type('image/svg+xml');
      return avatar.toString();
    } else if (format === 'json') {
      reply.type('application/json');
      return {
        svg: avatar.toString(),
        options: options
      };
    } else {
      reply.status(400).send({ error: 'Unsupported format. Use svg or json.' });
    }
  } catch (error) {
    app.log.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
});

// List available styles
app.get('/styles', async (request, reply) => {
  const styles = Object.keys(collection);
  return { styles };
});

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    app.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
