export class LandmarkService {
    constructor() {
        // API Configuration
        this.openaiURL = "https://api.openai.com/v1/chat/completions";
        this.ai_model = "gpt-5-nano-2025-08-07";
        this.apikey = ""; // Will be set from UI
        
        this.cors_proxy = 'https://corsproxy.io/?';
        this.search_url = 'https://www.googleapis.com/customsearch/v1';
        
        // Try to get keys from runtime config (window.env) first, then build-time env
        const env = window.env || {};
        this.googleApiKey = env.VITE_GOOGLE_SEARCH_API_KEY || import.meta.env.VITE_GOOGLE_SEARCH_API_KEY || "";
        this.googleCx = env.VITE_GOOGLE_SEARCH_CX || import.meta.env.VITE_GOOGLE_SEARCH_CX || "";
    }

    setApiKey(key) {
        this.apikey = key;
    }

    async fetchLandmarkData(country) {
        // Use test data when "test123" is entered
        if (country.toLowerCase() === 'test123') {
            const sampleText = `Eiffel Tower: An iconic wrought-iron lattice tower on the Champ de Mars in Paris, built in 1889 for the World's Fair. Standing at 324 meters tall, it was the world's tallest structure until 1930 and remains France's most visited paid monument with millions of tourists annually. / Statue of Liberty: A colossal neoclassical sculpture on Liberty Island in New York Harbor, gifted by France to the United States in 1886. The copper statue represents Libertas, the Roman goddess of liberty, and has become an enduring symbol of freedom and democracy welcoming immigrants to America. / Great Wall of China: An ancient series of fortifications built across northern China to protect against invasions, stretching over 13,000 miles. Construction began in the 7th century BC and continued through various dynasties. It's one of the most impressive architectural feats in human history and a UNESCO World Heritage site. / Taj Mahal: An ivory-white marble mausoleum on the right bank of the Yamuna river in Agra, India, commissioned by Mughal emperor Shah Jahan in 1632 for his beloved wife. This stunning monument to love combines Persian, Islamic, and Indian architectural styles and is considered the jewel of Muslim art.`;
            
            console.log("Using sample data:", sampleText);
            return this.processText(sampleText);
        }
        
        if (!this.apikey) {
            throw new Error("Please enter your OpenAI API key in the UI");
        }

        try {
            const response = await fetch(this.openaiURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apikey}`,
                },
                body: JSON.stringify({
                    model: this.ai_model,
                    messages: [{
                        role: "user",
                        content: `For the country of ${country}, I want you to return a brief description of each of this country's 4 most famous landmarks. Each description should be aproximately 45 words in length. Give your response in the following format: "Insert name of landmark 1 here: Insert Description 1 here (delimit with "/" symbol) Insert name of landmark 2 here: Insert Description 2 here (delimit with "/" symbol) Insert name of landmark 3 here: Insert Description 3 here (delimit with "/" symbol) Insert name of landmark 4 here: Insert Description 4 here"." It is vitally important that you delimit between each landmark with a / symbol`,
                    }],
                    max_completion_tokens: 10000,
                }),
            });

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                const generatedText = data.choices[0].message.content;
                console.log(generatedText);
                return this.processText(generatedText);
            }
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
        return [];
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

    async fetchImages(landmarks) {
        // Check if we're in test mode (based on landmark names)
        const isTestMode = landmarks.some(l => l.name && (l.name.includes('Eiffel Tower') || l.name.includes('Statue of Liberty')));
        
        if (isTestMode) {
            const sampleImageUrls = [
                'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=800', // Eiffel Tower
                'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?w=800', // Statue of Liberty
                'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800', // Great Wall
                'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800'  // Taj Mahal
            ];
            
            console.log("Using sample images");
            return sampleImageUrls;
        }
        
        if (!this.googleApiKey || !this.googleCx) {
            console.warn("Google API keys missing");
            return new Array(landmarks.length).fill(null);
        }

        const fetchImage = async (landmarkName) => {
            const url = `${this.search_url}?key=${this.googleApiKey}&cx=${this.googleCx}&searchType=image&q=${encodeURIComponent(landmarkName)}`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    return this.cors_proxy + data.items[0].link;
                }
            } catch (error) {
                console.error("Error fetching image", error);
            }
            return null;
        };

        const imagePromises = landmarks.map(l => fetchImage(l.name));
        return await Promise.all(imagePromises);
    }
}
