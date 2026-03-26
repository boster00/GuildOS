// ARCHIVED: Original path was libs/settings/class.js

import monkey from '@/libs/monkey.js';

class Settings {
    constructor(options = {}) {
        this.options = options;
    }

    get(key) {
        return this.options[key];
    }

    set(key, value) {
        this.options[key] = value;
    }

    async save(settingsKey, data) {
        try {
            // Load existing settings from profiles table
            const profile = await monkey.read('profiles', { id: monkey.user.id });
            
            if (!profile || profile.length === 0) {
                throw new Error('Profile not found');
            }

            // Check if data contains an API key
            if (data.apiKey && data.apiKey.trim() !== '') {
                // Map settingsKey to provider name for user_api_keys table
                const providerMap = {
                    'OpenAI': 'openai',
                    'Google_Gemini': 'gemini',
                    'Perplexity': 'perplexity',
                    'Anthropic_Claude': 'claude'
                };

                const provider = providerMap[settingsKey] || settingsKey.toLowerCase();

                // Check if API key entry already exists
                const existingKey = await monkey.read('user_api_keys', { 
                    user_id: monkey.user.id,
                    provider: provider 
                });

                if (existingKey && existingKey.length > 0) {
                    // Update existing API key
                    await monkey.update('user_api_keys', {
                        id: existingKey[0].id,
                        api_key: data.apiKey,
                        updated_at: new Date().toISOString()
                    });
                } else {
                    // Insert new API key
                    await monkey.write('user_api_keys', {
                        user_id: monkey.user.id,
                        provider: provider,
                        api_key: data.apiKey
                    });
                }
            }

            // Get existing json or initialize empty object
            const existingSettings = profile[0].json || {};
            
            // Update the specific settings key
            const updatedSettings = {
                ...existingSettings,
                [settingsKey]: data
            };

            // Update profiles table
            await monkey.update('profiles', {
                id: monkey.user.id,
                json: updatedSettings
            });

            // Update local options
            this.options = updatedSettings;
            
            return updatedSettings;
        } catch (error) {
            console.error('Failed to save settings:', error);
            throw error;
        }
    }
}

const settingsObj = new Settings();

export { Settings };
export default settingsObj;