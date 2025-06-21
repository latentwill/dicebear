import fastify from 'fastify';
import { createAvatar } from '@dicebear/core';
import * as collection from '@dicebear/collection';

const app = fastify({
  logger: true,
  trustProxy: true, // Important for Coolify/reverse proxy setups
});

// Rate limiting (adjust limits as needed)
await app.register(import('@fastify/rate-limit'), {
  max: 100, // 100 requests
  timeWindow: '1 minute', // per minute
  errorResponseBuilder: function (request: any, context: any) {
    return {
      code: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded, retry in ${context.ttl}ms`
    }
  }
});

// Security headers
app.addHook('onSend', (request, reply, payload, done) => {
  // CORS - Allow extndly.com subdomains and configured origins
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const origin = request.headers.origin;
  
  // Check if origin is allowed
  let isAllowed = false;
  
  if (origin) {
    // Check configured origins first (including wildcard)
    if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
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
      
      // Also check localhost for development
      if (!isAllowed && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        isAllowed = true;
      }
    }
  } else if (configuredOrigins.includes('*')) {
    // Allow wildcard if configured
    isAllowed = true;
  }
  
  if (isAllowed) {
    reply.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
  
  // Security headers
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  done();
});

// Input validation helper
function validateAvatarOptions(options: Record<string, any>): Record<string, any> {
  const validatedOptions: Record<string, any> = {};
  
  // Allow only specific parameter types and sanitize
  const allowedParams = [
    'seed', 'backgroundColor', 'radius', 'size', 'scale',
    'flip', 'rotate', 'translateX', 'translateY'
  ];
  
  for (const [key, value] of Object.entries(options)) {
    if (allowedParams.includes(key) && typeof value === 'string') {
      // Basic sanitization - remove potentially dangerous characters
      validatedOptions[key] = value.replace(/[<>\"'&]/g, '');
    }
  }
  
  return validatedOptions;
}

// Handle preflight OPTIONS requests
app.options('*', async (request, reply) => {
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const origin = request.headers.origin;
  
  // Check if origin is allowed (same logic as onSend hook)
  let isAllowed = false;
  
  if (origin) {
    // Check configured origins first (including wildcard)
    if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
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
      
      // Also check localhost for development
      if (!isAllowed && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        isAllowed = true;
      }
    }
  } else if (configuredOrigins.includes('*')) {
    // Allow wildcard if configured
    isAllowed = true;
  }
  
  if (isAllowed) {
    reply.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
  reply.status(200).send();
});

// Health check endpoint
app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Avatar generation endpoint with enhanced security
app.get('/:version/:style/:format', async (request, reply) => {
  const { version, style, format } = request.params as {
    version: string;
    style: string;
    format: string;
  };

  try {
    // Validate style parameter against known styles
    const availableStyles = Object.keys(collection);
    if (!availableStyles.includes(style)) {
      reply.status(404).send({ error: 'Style not found' });
      return;
    }

    // Validate format parameter
    if (!['svg', 'json'].includes(format)) {
      reply.status(400).send({ error: 'Unsupported format. Use svg or json.' });
      return;
    }

    // Get and validate query parameters
    const rawOptions = request.query as Record<string, any>;
    const options = validateAvatarOptions(rawOptions);
    
    // Get the style module
    const styleModule = (collection as any)[style];
    
    // Create the avatar with validated options
    const avatar = createAvatar(styleModule, options);
    
    // Return the appropriate format
    if (format === 'svg') {
      reply.type('image/svg+xml');
      // Add cache headers for better performance
      reply.header('Cache-Control', 'public, max-age=3600'); // 1 hour cache
      return avatar.toString();
    } else {
      reply.type('application/json');
      reply.header('Cache-Control', 'public, max-age=3600');
      return {
        svg: avatar.toString(),
        options: options
      };
    }
  } catch (error) {
    app.log.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
});

// List available styles
app.get('/styles', async (request, reply) => {
  const styles = Object.keys(collection);
  reply.header('Cache-Control', 'public, max-age=86400'); // 24 hour cache
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
