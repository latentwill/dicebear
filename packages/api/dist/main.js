"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const core_1 = require("@dicebear/core");
const collection = __importStar(require("@dicebear/collection"));
const app = (0, fastify_1.default)({
    logger: true,
});
// Add CORS headers using onSend hook as requested
app.addHook('onSend', (request, reply, payload, done) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    done();
});
// Handle preflight OPTIONS requests
app.options('*', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    reply.status(200).send();
});
// Health check endpoint
app.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});
// Avatar generation endpoint
app.get('/:version/:style/:format', async (request, reply) => {
    const { version, style, format } = request.params;
    try {
        // Get the style from the collection
        const styleModule = collection[style];
        if (!styleModule) {
            reply.status(404).send({ error: 'Style not found' });
            return;
        }
        // Get query parameters for avatar options
        const options = request.query;
        // Create the avatar
        const avatar = (0, core_1.createAvatar)(styleModule, options);
        // Return the appropriate format
        if (format === 'svg') {
            reply.type('image/svg+xml');
            return avatar.toString();
        }
        else if (format === 'json') {
            reply.type('application/json');
            return {
                svg: avatar.toString(),
                options: options
            };
        }
        else {
            reply.status(400).send({ error: 'Unsupported format. Use svg or json.' });
        }
    }
    catch (error) {
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
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=main.js.map