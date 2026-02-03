import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

const PORT = Number(process.env.PORT || 8787);
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 15000);
const FREE_TRIAL_MAX = Number(process.env.FREE_TRIAL_MAX || 3);
const FREE_TRIAL_WINDOW_MS = Number(process.env.FREE_TRIAL_WINDOW_MS || 1000 * 60 * 60 * 24);

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano';
const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS || 650);
const OPENAI_REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || 'minimal';

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
const ANTHROPIC_MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS || 650);

const GOOGLE_MODEL = process.env.GOOGLE_MODEL || 'gemini-1.5-flash';
const GOOGLE_MAX_TOKENS = Number(process.env.GOOGLE_MAX_TOKENS || 650);

const BASE_PROMPT =
    'Return JSON only. Provide exactly 4 famous landmarks for the given country. ' +
    'Each description must be 25-40 words. Keep language simple and factual. ' +
    'JSON schema: {"landmarks":[{"name":"string","desc":"string"}]}';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.map': 'application/json; charset=utf-8',
};

const freeTrials = new Map();

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const first = String(forwarded).split(',')[0];
        if (first) return first.trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (realIp) return String(realIp).trim();
    return req.socket?.remoteAddress || 'unknown';
}

function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => {
            data += chunk;
            if (data.length > 1_000_000) {
                reject(new Error('Request body too large'));
            }
        });
        req.on('end', () => {
            if (!data) return resolve({});
            try {
                resolve(JSON.parse(data));
            } catch {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

function normalizeProvider(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (value === 'anthropic') return 'anthropic';
    if (value === 'google') return 'google';
    return 'openai';
}

function extractJson(text) {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : null;
}

function normalizeLandmarks(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((item) => ({
            name: typeof item?.name === 'string' ? item.name.trim() : '',
            desc: typeof item?.desc === 'string' ? item.desc.trim() : '',
        }))
        .filter((item) => item.name)
        .slice(0, 4);
}

function parseSlashFormat(text) {
    const parts = String(text || '').split('/');
    const landmarks = [];
    for (let i = 0; i < 4; i++) {
        if (!parts[i]) continue;
        const [name, desc] = parts[i].split(':');
        landmarks.push({
            name: name ? name.trim() : '',
            desc: desc ? desc.trim() : '',
        });
    }
    return landmarks;
}

function parseLandmarksFromText(text) {
    if (typeof text !== 'string') return [];
    const jsonText = extractJson(text);
    if (jsonText) {
        try {
            const obj = JSON.parse(jsonText);
            const normalized = normalizeLandmarks(obj?.landmarks);
            if (normalized.length) return normalized;
        } catch {
            // fall through to slash parsing
        }
    }
    return normalizeLandmarks(parseSlashFormat(text));
}

async function callOpenAI(apiKey, country) {
    const response = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                reasoning_effort: OPENAI_REASONING_EFFORT,
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'landmarks_response',
                        strict: true,
                        schema: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['landmarks'],
                            properties: {
                                landmarks: {
                                    type: 'array',
                                    minItems: 4,
                                    maxItems: 4,
                                    items: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: ['name', 'desc'],
                                        properties: {
                                            name: { type: 'string' },
                                            desc: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                messages: [
                    { role: 'developer', content: BASE_PROMPT },
                    { role: 'user', content: country },
                ],
                max_completion_tokens: OPENAI_MAX_TOKENS,
            }),
        },
        TIMEOUT_MS
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const msg =
            data?.error?.message ||
            `OpenAI request failed (${response.status} ${response.statusText})`;
        throw new Error(msg);
    }
    return data?.choices?.[0]?.message?.content || '';
}

async function callAnthropic(apiKey, country) {
    const response = await fetchWithTimeout(
        'https://api.anthropic.com/v1/messages',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: ANTHROPIC_MAX_TOKENS,
                temperature: 0.3,
                system: BASE_PROMPT,
                messages: [{ role: 'user', content: country }],
            }),
        },
        TIMEOUT_MS
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const msg =
            data?.error?.message ||
            `Anthropic request failed (${response.status} ${response.statusText})`;
        throw new Error(msg);
    }
    const block = Array.isArray(data?.content) ? data.content[0] : null;
    return block?.text || '';
}

async function callGoogle(apiKey, country) {
    const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GOOGLE_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetchWithTimeout(
        endpoint,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: country }],
                    },
                ],
                systemInstruction: {
                    parts: [{ text: BASE_PROMPT }],
                },
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: GOOGLE_MAX_TOKENS,
                },
            }),
        },
        TIMEOUT_MS
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const msg =
            data?.error?.message ||
            `Google request failed (${response.status} ${response.statusText})`;
        throw new Error(msg);
    }
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function generateLandmarks(provider, apiKey, country) {
    const normalized = normalizeProvider(provider);
    let text = '';
    if (normalized === 'anthropic') {
        text = await callAnthropic(apiKey, country);
    } else if (normalized === 'google') {
        text = await callGoogle(apiKey, country);
    } else {
        text = await callOpenAI(apiKey, country);
    }

    const landmarks = parseLandmarksFromText(text);
    if (!landmarks.length) {
        throw new Error('AI response could not be parsed. Please try again.');
    }
    return landmarks;
}

function serveStatic(req, res, pathname) {
    const safePath = path.normalize(path.join(distDir, pathname));
    if (!safePath.startsWith(distDir)) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
    }

    let filePath = safePath;
    try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }
    } catch {
        filePath = path.join(distDir, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
        filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (pathname === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('ok');
        return;
    }

    if (pathname === '/api/landmarks' || pathname === '/api/landmarks/free') {
        if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'Method not allowed' });
            return;
        }

        try {
            const body = await readJsonBody(req);
            const country = String(body?.country || '').trim();
            if (!country) {
                sendJson(res, 400, { error: 'Country is required' });
                return;
            }

            if (pathname === '/api/landmarks/free') {
                const freeKey = process.env.OPENAI_API_KEY;
                if (!freeKey) {
                    sendJson(res, 500, { error: 'Server free trial is not configured' });
                    return;
                }
                const clientIp = getClientIp(req);
                const now = Date.now();
                let trial = freeTrials.get(clientIp);
                if (!trial || now >= trial.resetAt) {
                    trial = {
                        remaining: FREE_TRIAL_MAX,
                        resetAt: now + FREE_TRIAL_WINDOW_MS,
                    };
                    freeTrials.set(clientIp, trial);
                }
                if (trial.remaining <= 0) {
                    sendJson(res, 403, {
                        error: 'Free trial used up',
                        remaining: 0,
                        resetAt: trial.resetAt,
                    });
                    return;
                }

                const landmarks = await generateLandmarks('openai', freeKey, country);
                trial.remaining = Math.max(0, trial.remaining - 1);
                freeTrials.set(clientIp, trial);

                sendJson(res, 200, {
                    landmarks,
                    remaining: trial.remaining,
                    resetAt: trial.resetAt,
                });
                return;
            }

            const provider = normalizeProvider(body?.provider);
            const apiKey = String(body?.apiKey || '').trim();
            if (!apiKey) {
                sendJson(res, 400, { error: 'API key is required' });
                return;
            }

            const landmarks = await generateLandmarks(provider, apiKey, country);
            sendJson(res, 200, { landmarks });
        } catch (error) {
            const message = error?.message || 'Request failed';
            sendJson(res, 500, { error: message });
        }
        return;
    }

    serveStatic(req, res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
