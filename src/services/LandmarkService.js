export class LandmarkService {
    constructor() {
        // API Configuration (server-side calls)
        this.provider = "openai";
        this.apikey = ""; // Will be set from UI
        this.useFreeTrial = false;
        this.freeTrialRemaining = 3;
        this.freeTrialResetAt = null;
        this.onFreeTrialChange = null;

        // Speed + reliability knobs (client-to-server)
        this.aiTimeoutMs = 15000;

        // Cache results so repeated searches are instant.
        this._landmarkCache = new Map(); // key -> { at:number, data:Array }
        this._cacheTtlMs = 1000 * 60 * 60 * 24 * 7; // 7 days

        // Cache Wikimedia image lookups too (saves latency + avoids rate limiting).
        this._imageCache = new Map(); // key -> { at:number, data:Array<string> }
    }

    setProvider(provider) {
        const value = String(provider || "").trim().toLowerCase();
        if (value === "anthropic" || value === "google") {
            this.provider = value;
        } else {
            this.provider = "openai";
        }
    }

    setApiKey(key) {
        this.apikey = String(key || "").trim();
    }

    setFreeTrialState(enabled, remaining) {
        this.useFreeTrial = Boolean(enabled);
        if (Number.isFinite(remaining)) {
            this.freeTrialRemaining = Math.max(0, Number(remaining));
        }
    }

    setFreeTrialResetAt(resetAt) {
        if (Number.isFinite(resetAt)) {
            this.freeTrialResetAt = Number(resetAt);
        } else {
            this.freeTrialResetAt = null;
        }
    }

    setUseFreeTrial(enabled) {
        this.useFreeTrial = Boolean(enabled);
    }

    setFreeTrialRemaining(remaining) {
        if (Number.isFinite(remaining)) {
            this.freeTrialRemaining = Math.max(0, Number(remaining));
        }
    }

    decrementFreeTrial() {
        this.freeTrialRemaining = Math.max(0, this.freeTrialRemaining - 1);
        if (this.onFreeTrialChange) {
            this.onFreeTrialChange(this.freeTrialRemaining, this.freeTrialResetAt);
        }
    }

    async fetchLandmarkData(country) {
        // Use test data when "test123" is entered
        if (country.toLowerCase() === 'test123') {
            const sampleText = `Eiffel Tower: An iconic wrought-iron lattice tower on the Champ de Mars in Paris, built in 1889 for the World's Fair. Standing at 324 meters tall, it was the world's tallest structure until 1930 and remains France's most visited paid monument with millions of tourists annually. / Statue of Liberty: A colossal neoclassical sculpture on Liberty Island in New York Harbor, gifted by France to the United States in 1886. The copper statue represents Libertas, the Roman goddess of liberty, and has become an enduring symbol of freedom and democracy welcoming immigrants to America. / Great Wall of China: An ancient series of fortifications built across northern China to protect against invasions, stretching over 13,000 miles. Construction began in the 7th century BC and continued through various dynasties. It's one of the most impressive architectural feats in human history and a UNESCO World Heritage site. / Taj Mahal: An ivory-white marble mausoleum on the right bank of the Yamuna river in Agra, India, commissioned by Mughal emperor Shah Jahan in 1632 for his beloved wife. This stunning monument to love combines Persian, Islamic, and Indian architectural styles and is considered the jewel of Muslim art.`;
            
            console.log("Using sample data:", sampleText);
            return this.processText(sampleText);
        }

        if (this.useFreeTrial) {
            if (this.freeTrialRemaining <= 0) {
                const now = Date.now();
                if (this.freeTrialResetAt && now < this.freeTrialResetAt) {
                    throw new Error("Free trial used up. Please enter your own API key.");
                }
            }
        } else if (!this.apikey) {
            const label = this.provider === "anthropic"
                ? "Anthropic"
                : this.provider === "google"
                    ? "Google"
                    : "OpenAI";
            throw new Error(`Please enter your ${label} API key in the UI`);
        }

        const cached = this.getCachedLandmarks(country);
        if (cached) return cached;

        let timeoutId;
        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), this.aiTimeoutMs);

            const endpoint = this.useFreeTrial ? "/api/landmarks/free" : "/api/landmarks";
            const payload = this.useFreeTrial
                ? { country }
                : { country, provider: this.provider, apiKey: this.apikey };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            const data = await response.json().catch(() => null);
            if (!response.ok) {
                if (this.useFreeTrial && Number.isFinite(data?.remaining)) {
                    this.setFreeTrialRemaining(data.remaining);
                    if (Number.isFinite(data?.resetAt)) {
                        this.setFreeTrialResetAt(data.resetAt);
                    }
                    if (this.onFreeTrialChange) {
                        this.onFreeTrialChange(this.freeTrialRemaining, this.freeTrialResetAt);
                    }
                }
                const msg =
                    data?.error?.message ||
                    data?.error ||
                    `AI request failed (${response.status} ${response.statusText})`;
                throw new Error(msg);
            }

            const landmarks = Array.isArray(data?.landmarks) ? data.landmarks : [];
            if (landmarks.length > 0) {
                this.setCachedLandmarks(country, landmarks);
                if (this.useFreeTrial) {
                    if (Number.isFinite(data?.remaining)) {
                        this.setFreeTrialRemaining(data.remaining);
                        if (Number.isFinite(data?.resetAt)) {
                            this.setFreeTrialResetAt(data.resetAt);
                        }
                        if (this.onFreeTrialChange) {
                            this.onFreeTrialChange(this.freeTrialRemaining, this.freeTrialResetAt);
                        }
                    } else {
                        this.decrementFreeTrial();
                    }
                }
                return landmarks;
            }
        } catch (error) {
            if (error?.name === "AbortError") {
                throw new Error("AI request timed out. Please try again.");
            }
            console.error('Error:', error);
            throw error;
        } finally {
            // Clear the timeout even if fetch throws (AbortError, network errors, etc.).
            try { clearTimeout(timeoutId); } catch { /* no-op */ }
        }
        return [];
    }

    processStructuredLandmarks(generatedText) {
        try {
            const obj = JSON.parse(generatedText);
            const list = obj?.landmarks;
            if (!Array.isArray(list)) return [];

            return list
                .slice(0, 4)
                .map((l) => ({
                    name: typeof l?.name === "string" ? l.name.trim() : "",
                    desc: typeof l?.desc === "string" ? l.desc.trim() : ""
                }))
                .filter((l) => l.name);
        } catch {
            return [];
        }
    }

    processText(generatedText) {
        try {
            const parts = generatedText.split('/');
            const landmarks = [];
            
            for (let i = 0; i < 4; i++) {
                if (parts[i]) {
                    const [name, desc] = parts[i].split(':');
                    landmarks.push({
                        name: name ? name.trim() : "",
                        desc: desc ? desc.trim() : ""
                    });
                }
            }
            return landmarks;
        } catch (error) {
            console.error("Error processing text", error);
            return [];
        }
    }

    getCachedLandmarks(country) {
        const key = this.normalizeCountryKey(country);
        const now = Date.now();

        const inMem = this._landmarkCache.get(key);
        if (inMem && now - inMem.at < this._cacheTtlMs) return inMem.data;

        try {
            const raw = localStorage.getItem(`landmark_cache:${key}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.at || !Array.isArray(parsed?.data)) return null;
            if (now - parsed.at >= this._cacheTtlMs) return null;

            this._landmarkCache.set(key, parsed);
            return parsed.data;
        } catch {
            return null;
        }
    }

    setCachedLandmarks(country, data) {
        const key = this.normalizeCountryKey(country);
        const payload = { at: Date.now(), data };
        this._landmarkCache.set(key, payload);
        try {
            localStorage.setItem(`landmark_cache:${key}`, JSON.stringify(payload));
        } catch {
            // Ignore storage quota / privacy mode failures.
        }
    }

    getCachedImageCandidates(query) {
        const key = this.normalizeCountryKey(query);
        const now = Date.now();

        const inMem = this._imageCache.get(key);
        if (inMem && now - inMem.at < this._cacheTtlMs && Array.isArray(inMem.data)) return inMem.data;

        try {
            const raw = localStorage.getItem(`image_cache:${key}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.at || !Array.isArray(parsed?.data)) return null;
            if (now - parsed.at >= this._cacheTtlMs) return null;

            this._imageCache.set(key, parsed);
            return parsed.data;
        } catch {
            return null;
        }
    }

    setCachedImageCandidates(query, data) {
        const key = this.normalizeCountryKey(query);
        const payload = { at: Date.now(), data };
        this._imageCache.set(key, payload);
        try {
            localStorage.setItem(`image_cache:${key}`, JSON.stringify(payload));
        } catch {
            // Ignore storage quota / privacy mode failures.
        }
    }

    normalizeCountryKey(country) {
        return String(country || "").trim().toLowerCase();
    }

    async fetchImages(landmarks) {
        const imagePromises = landmarks.map((l) => {
            if (!l?.name) return Promise.resolve(null);
            return this.fetchWikimediaImageCandidates(l.name);
        });

        return await Promise.all(imagePromises);
    }

    async fetchWikimediaImageCandidates(query) {
        const cached = this.getCachedImageCandidates(query);
        if (cached) return cached;

        const fromWikipedia = await this.fetchWikipediaPageImageCandidates(query);
        if (fromWikipedia && fromWikipedia.length > 0) {
            this.setCachedImageCandidates(query, fromWikipedia);
            return fromWikipedia;
        }

        const fromCommons = await this.fetchCommonsFileImageCandidates(query);
        if (fromCommons && fromCommons.length > 0) {
            this.setCachedImageCandidates(query, fromCommons);
            return fromCommons;
        }

        return null;
    }

    async fetchWikipediaPageImageCandidates(query) {
        const endpoint = "https://en.wikipedia.org/w/api.php";
        const params = new URLSearchParams({
            action: "query",
            format: "json",
            origin: "*",
            redirects: "1",
            generator: "search",
            gsrsearch: query,
            gsrlimit: "1",
            gsrnamespace: "0",
            prop: "pageimages",
            piprop: "thumbnail|original",
            pithumbsize: "1024"
        });

        try {
            const response = await fetch(`${endpoint}?${params.toString()}`);
            const data = await response.json();

            const pagesObj = data?.query?.pages;
            if (!pagesObj) return null;

            const pages = Object.values(pagesObj);
            if (pages.length === 0) return null;

            pages.sort((a, b) => (a?.index ?? 999) - (b?.index ?? 999));
            const page = pages[0];
            if (!page) return null;

            const candidates = [];
            if (page.thumbnail?.source) candidates.push(page.thumbnail.source);
            if (page.original?.source) candidates.push(page.original.source);

            return candidates.length > 0 ? candidates : null;
        } catch (error) {
            console.error("Error fetching Wikipedia image", error);
            return null;
        }
    }

    async fetchCommonsFileImageCandidates(query) {
        const endpoint = "https://commons.wikimedia.org/w/api.php";
        const params = new URLSearchParams({
            action: "query",
            format: "json",
            origin: "*",
            generator: "search",
            gsrsearch: query,
            gsrlimit: "1",
            gsrnamespace: "6", // File:
            prop: "imageinfo",
            iiprop: "url",
            iiurlwidth: "1024"
        });

        try {
            const response = await fetch(`${endpoint}?${params.toString()}`);
            const data = await response.json();

            const pagesObj = data?.query?.pages;
            if (!pagesObj) return null;

            const pages = Object.values(pagesObj);
            if (pages.length === 0) return null;

            pages.sort((a, b) => (a?.index ?? 999) - (b?.index ?? 999));
            const page = pages[0];
            const info = page?.imageinfo?.[0];
            if (!info) return null;

            const candidates = [];
            if (info.thumburl) candidates.push(info.thumburl);
            if (info.url) candidates.push(info.url);

            return candidates.length > 0 ? candidates : null;
        } catch (error) {
            console.error("Error fetching Wikimedia Commons image", error);
            return null;
        }
    }
}
