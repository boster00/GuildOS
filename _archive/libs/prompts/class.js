// ARCHIVED: Original path was libs/prompts/class.js

import monkey from "@/libs/monkey";

class Prompts {
    constructor() {
        this.table = 'prompts';
        this.monkey = monkey;
        this.fields = [
            { key: "text", label: "Prompt Text", placeholder: "Enter the prompt..." },
            { key: "icp_id", label: "ICP ID", placeholder: "Related ICP ID..." },
            { key: "visibility", label: "Visibility Score", placeholder: "Visibility score (0-100)..." },
            { key: "entity_json", label: "Entity JSON", placeholder: "Full prompt data as JSON..." },
        ];
        this.fieldKeys = this.fields.map(f => f.key);
    }
    async AI(query){
        const url = "/api/ai";
        const data = { query };

        // monkey.apiCall returns nothing, so we need to wrap it in a Promise for await
        console.log("prompts->AI called with query:", query);
        const response = await this.monkey.apiCall(
            url,
            data
        );
        console.log("prompts->AI response:", response);
        
        return response;
    }

    async get(id) {
        // get everything about the prompt with this id
        // 1. get the prompt itself
        const results = await this.monkey.read(this.table, [
            { operator: 'eq', args: ['id', id] }
        ]);
        const output = results?.[0] || null;
        const brand_name = output?.brand_name;
        if(!output) return null;
        // 2. get the icp
        const icp = results?.[0]?.icp_id ? await this.monkey.read('icps', [
            { operator: 'eq', args: ['id', results[0].icp_id] }
        ]) : null;
        output.icp = icp?.[0] || null;
        output.brand_name = brand_name;

        // 3. get prompt execution history from cron_history
        const promptHistory = await this.getHistory([id]);
        output.history = promptHistory;

        return output;
    }

    /**
     * Get execution history for prompts from cron_history table
     * @param {Array} taskIds - Array of prompt/task IDs to fetch history for
     * @returns {Array} Array of result strings from json.result field
     */
    async getHistory(taskIds) {
        monkey.log("Loading execution history for task IDs:", taskIds);
        
        // Query cron_history where task_id matches and status is 'completed' or 'failed'
        const history = await this.monkey.read('cron_history', [
            { operator: 'in', args: ['task_id', taskIds] },
            { operator: 'select', args: ['*'] }
        ]);
        
        // Extract result strings from json.result field
        return history.map(record => ({
            result: record.json?.result || null,
            model: record.json?.model || null,
            status: record.status || 'unknown',
            executed_at: record.executed_at,
            worker_id: record.worker_id,
            job_type: record.job_type
        }));
    }

    async list(filters = {}) {
        if (Object.keys(filters).length === 0) {
            return await this.monkey.read(this.table);
        }
        // Convert filters to array of { operator: 'eq', args: [key, value] }
        const settings = Object.entries(filters).map(
            ([key, value]) => ({ operator: 'eq', args: [key, value] })
        );
        return await this.monkey.read(this.table, settings);
    }

    async create(data) {
        if (!data.user_id) {
            data.user_id = this.monkey.user?.id;
        }
        return await this.monkey.write(this.table, data);
    }

    async update(id, data) {
        console.log("Updating prompt ID:", id, "with data:", data, this.monkey.supabase);
        return await this.monkey.update(this.table, data, id);
    }

    async delete(id) {
        return await this.monkey.delete(this.table, id);
    }

    async search(query) {
        return await this.monkey.searchText(this.table, ['text'], query);
    }

    async bulkUpdate(ids, updateData) {
        return await this.monkey.bulkUpdate(this.table, ids, updateData);
    }

    async getStats(id) {
        const prompt = await this.get(id);
        if (!prompt) return null;
        // Example: count related ICPs, etc.
        return {
            id,
            text: prompt.text,
            icp_id: prompt.icp_id,
            visibility: prompt.visibility,
            lastUsed: new Date(prompt.updated_at || prompt.created_at).getTime()
        };
    }

    async export(idOrIds) {
        if (Array.isArray(idOrIds)) {
            const prompts = await this.monkey.read(this.table, [
                { operator: 'eq', args: ['id', idOrIds] }
            ]);
            if (!prompts || prompts.length === 0) throw new Error('No prompts found');
            return prompts.map(p => ({
                version: '1.0',
                exportedAt: new Date().toISOString(),
                data: p.entity_json
            }));
        } else {
            const prompt = await this.get(idOrIds);
            if (!prompt) throw new Error('Prompt not found');
            return {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                data: prompt.entity_json
            };
        }
    }

    async import(jsonData) {
        if (jsonData.version !== '1.0') {
            throw new Error('Unsupported import version');
        }
        return await this.create(jsonData.data);
    }

    async bulkImport(jsonArray) {
        const results = [];
        for (const jsonData of jsonArray) {
            try {
                const result = await this.import(jsonData);
                results.push({ success: true, data: result });
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
        }
        return results;
    }

    async validate(data) {
        const errors = [];
        if (!data.text?.trim()) {
            errors.push('Prompt text is required');
        }
        if (!data.icp_id?.trim()) {
            errors.push('ICP ID is required');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

export async function initPrompts() {
    await monkey.init(true);
    return new Prompts();
}

export { Prompts };

const prompts = new Prompts();
export { prompts };