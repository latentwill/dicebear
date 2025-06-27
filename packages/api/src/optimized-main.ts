import fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { createAvatar } from '@dicebear/core';
import * as collection from '@dicebear/collection';
import crypto from 'crypto';

// Extend FastifyRequest to include startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

// In-memory cache for generated avatars
const avatarCache = new Map<string, { svg: string; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Performance monitoring
const performanceMetrics = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  averageResponseTime: 0,
  responseTimeSum: 0,
  popularSeeds: new Map<string, number>(),
  popularStyles: new Map<string, number>(),
};

const app = fastify({
  logger: true,
  trustProxy: true,
});

// Register compression plugin for Gzip/Brotli
await app.register(import('@fastify/compress'), {
  global: true,
  encodings: ['gzip', 'deflate', 'br'],
});

// Rate limiting
await app.register(import('@fastify/rate-limit'), {
  max: 200, // Increased for better performance
  timeWindow: '1 minute',
  errorResponseBuilder: function (request: any, context: any) {
    return {
      code: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded, retry in ${context.ttl}ms`
    }
  }
});

// Performance monitoring hook
app.addHook('onRequest', async (request, reply) => {
  request.startTime = Date.now();
});

app.addHook('onResponse', async (request, reply) => {
  const responseTime = Date.now() - (request.startTime || Date.now());
  performanceMetrics.totalRequests++;
  performanceMetrics.responseTimeSum += responseTime;
  performanceMetrics.averageResponseTime = performanceMetrics.responseTimeSum / performanceMetrics.totalRequests;
  
  app.log.info(`${request.method} ${request.url} - ${reply.statusCode} - ${responseTime}ms`);
});

// Security and CORS headers
app.addHook('onSend', (request, reply, payload, done) => {
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const origin = request.headers.origin;
  
  let isAllowed = false;
  
  if (origin) {
    if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
      isAllowed = true;
    } else {
      try {
        const url = new URL(origin);
        if (url.hostname === 'extndly.com' || url.hostname.endsWith('.extndly.com')) {
          isAllowed = true;
        }
      } catch (error) {
        isAllowed = false;
      }
      
      if (!isAllowed && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        isAllowed = true;
      }
    }
  } else if (configuredOrigins.includes('*')) {
    isAllowed = true;
  }
  
  if (isAllowed) {
    reply.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  done();
});

// Cache cleanup function
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of avatarCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      avatarCache.delete(key);
    }
  }
}

// Run cache cleanup every 10 minutes
setInterval(cleanupCache, 10 * 60 * 1000);

// Generate ETag based on cache key
function generateETag(cacheKey: string): string {
  return crypto.createHash('md5').update(cacheKey).digest('hex');
}

// Validate and parse size parameter
function validateSize(size: string | undefined): number {
  if (!size) return 64; // default size
  
  const sizeNum = parseInt(size, 10);
  const allowedSizes = [16, 24, 32, 48, 64, 96, 128, 256, 512];
  
  if (allowedSizes.includes(sizeNum)) {
    return sizeNum;
  }
  
  // Return closest allowed size
  return allowedSizes.reduce((prev, curr) => 
    Math.abs(curr - sizeNum) < Math.abs(prev - sizeNum) ? curr : prev
  );
}

// Input validation helper
function validateAvatarOptions(options: Record<string, any>): Record<string, any> {
  const validatedOptions: Record<string, any> = {};
  
  const allowedParams = [
    'seed', 'backgroundColor', 'radius', 'scale',
    'flip', 'rotate', 'translateX', 'translateY',
    'size', 'v' // Added size and version parameters
  ];
  
  for (const [key, value] of Object.entries(options)) {
    if (allowedParams.includes(key) && typeof value === 'string') {
      validatedOptions[key] = value.replace(/[<>\"'&]/g, '');
    }
  }
  
  return validatedOptions;
}

// Helper functions
function dashToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}

function camelCaseToDash(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// Handle preflight OPTIONS requests
app.options('*', async (request, reply) => {
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const origin = request.headers.origin;
  
  let isAllowed = false;
  
  if (origin) {
    if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
      isAllowed = true;
    } else {
      try {
        const url = new URL(origin);
        if (url.hostname === 'extndly.com' || url.hostname.endsWith('.extndly.com')) {
          isAllowed = true;
        }
      } catch (error) {
        isAllowed = false;
      }
      
      if (!isAllowed && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        isAllowed = true;
      }
    }
  } else if (configuredOrigins.includes('*')) {
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

// Performance metrics endpoint
app.get('/metrics', async (request, reply) => {
  const cacheHitRate = performanceMetrics.totalRequests > 0 
    ? (performanceMetrics.cacheHits / performanceMetrics.totalRequests * 100).toFixed(2)
    : '0.00';
    
  return {
    totalRequests: performanceMetrics.totalRequests,
    cacheHits: performanceMetrics.cacheHits,
    cacheMisses: performanceMetrics.cacheMisses,
    cacheHitRate: `${cacheHitRate}%`,
    averageResponseTime: `${performanceMetrics.averageResponseTime.toFixed(2)}ms`,
    cacheSize: avatarCache.size,
    popularSeeds: Object.fromEntries(
      Array.from(performanceMetrics.popularSeeds.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
    ),
    popularStyles: Object.fromEntries(
      Array.from(performanceMetrics.popularStyles.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
    )
  };
});

// Enhanced avatar generation endpoint with all optimizations
app.get('/:version/:style/:format', async (request, reply) => {
  const { version, style, format } = request.params as {
    version: string;
    style: string;
    format: string;
  };

  try {
    // Convert dash-separated style name to camelCase for collection lookup
    const camelCaseStyle = dashToCamelCase(style);
    
    // Validate style parameter against known styles
    const availableStyles = Object.keys(collection);
    if (!availableStyles.includes(camelCaseStyle)) {
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
    
    // Parse and validate size parameter
    const size = validateSize(options.size);
    const seed = options.seed || 'default';
    const versionParam = options.v;
    
    // Track popular seeds and styles
    const currentSeedCount = performanceMetrics.popularSeeds.get(seed) || 0;
    performanceMetrics.popularSeeds.set(seed, currentSeedCount + 1);
    
    const currentStyleCount = performanceMetrics.popularStyles.get(style) || 0;
    performanceMetrics.popularStyles.set(style, currentStyleCount + 1);
    
    // Create cache key including size and version
    const cacheKey = `${seed}-${style}-${size}-${versionParam || 'dev'}-${JSON.stringify(options)}`;
    const etag = generateETag(cacheKey);
    
    // Check if client has cached version
    const clientETag = request.headers['if-none-match'];
    if (clientETag === etag) {
      reply.status(304).send();
      return;
    }
    
    // Check server-side cache
    const cached = avatarCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      performanceMetrics.cacheHits++;
      
      // Set cache headers based on version parameter
      const cacheControl = versionParam 
        ? 'public, max-age=31536000, immutable' // 1 year for versioned requests
        : 'public, max-age=3600'; // 1 hour for non-versioned
      
      reply.header('Cache-Control', cacheControl);
      reply.header('ETag', etag);
      
      if (format === 'svg') {
        reply.type('image/svg+xml');
        return cached.svg;
      } else {
        reply.type('application/json');
        return {
          svg: cached.svg,
          options: options,
          size: size
        };
      }
    }
    
    performanceMetrics.cacheMisses++;
    
    // Get the style module using camelCase name
    const styleModule = (collection as any)[camelCaseStyle];
    
    // Add size to options for avatar generation
    const avatarOptions = { ...options, size };
    
    // Create the avatar with validated options including size
    const avatar = createAvatar(styleModule, avatarOptions);
    const svgString = avatar.toString();
    
    // Cache the generated avatar
    avatarCache.set(cacheKey, {
      svg: svgString,
      timestamp: Date.now()
    });
    
    // Set cache headers based on version parameter
    const cacheControl = versionParam 
      ? 'public, max-age=31536000, immutable' // 1 year for versioned requests
      : 'public, max-age=3600'; // 1 hour for non-versioned
    
    reply.header('Cache-Control', cacheControl);
    reply.header('ETag', etag);
    
    // Return the appropriate format
    if (format === 'svg') {
      reply.type('image/svg+xml');
      return svgString;
    } else {
      reply.type('application/json');
      return {
        svg: svgString,
        options: avatarOptions,
        size: size
      };
    }
  } catch (error) {
    app.log.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
});

// List available styles
app.get('/styles', async (request, reply) => {
  const camelCaseStyles = Object.keys(collection);
  const styles = camelCaseStyles.map(style => camelCaseToDash(style));
  
  reply.header('Cache-Control', 'public, max-age=86400'); // 24 hour cache
  return { styles };
});

// Preload popular avatars (runs in background)
async function preloadPopularAvatars() {
  const popularCombinations = [
    { style: 'avataaars', seed: 'john', size: 64 },
    { style: 'avataaars', seed: 'jane', size: 64 },
    { style: 'bottts', seed: 'robot1', size: 64 },
    { style: 'identicon', seed: 'user123', size: 32 },
    { style: 'initials', seed: 'AB', size: 48 },
  ];
  
  for (const combo of popularCombinations) {
    try {
      const camelCaseStyle = dashToCamelCase(combo.style);
      const styleModule = (collection as any)[camelCaseStyle];
      
      if (styleModule) {
        const cacheKey = `${combo.seed}-${combo.style}-${combo.size}-dev-{}`;
        
        if (!avatarCache.has(cacheKey)) {
          const avatar = createAvatar(styleModule, { 
            seed: combo.seed, 
            size: combo.size 
          });
          
          avatarCache.set(cacheKey, {
            svg: avatar.toString(),
            timestamp: Date.now()
          });
          
          app.log.info(`Preloaded avatar: ${combo.style}/${combo.seed}/${combo.size}`);
        }
      }
    } catch (error) {
      app.log.error(`Failed to preload avatar ${combo.style}/${combo.seed}:`, error);
    }
  }
}

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    app.log.info(`Optimized DiceBear server listening on ${host}:${port}`);
    
    // Preload popular avatars after server starts
    setTimeout(preloadPopularAvatars, 5000); // Wait 5 seconds after startup
    
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
