import monkey from "@/libs/monkey";

class ICP {
    constructor() {
        this.table = 'icps';
        this.monkey = monkey;
        // ICP now only has name and description fields (per database schema)
        this.fields = [];
        this.fieldKeys = [];
    }

    async AI(query){
        const url = "/api/ai";
        const data = { query };

        // monkey.apiCall returns nothing, so we need to wrap it in a Promise for await
        const response = await this.monkey.apiCall(
            url,
            data
        );
        return response;
    }

    // ================================
    // FREQUENTLY USED - Core CRUD
    // ================================
    
    async get(id) {
        const results = await this.monkey.read(this.table, [
            { operator: 'eq', args: ['id', id] }
        ]);
        return results?.[0] || null;
    }
    
    async list(filters = {}) {
        const orderBy = { operator: 'order', args: ['updated_at', { ascending: false }] };
        if (Object.keys(filters).length === 0) {
            return await this.monkey.read(this.table, [orderBy]);
        }
        // Ensure filters is an array and add order
        const filterArray = Array.isArray(filters) ? filters : [filters];
        return await this.monkey.read(this.table, [...filterArray, orderBy]);
    }
    
    async create(data) {
        data.user_id = this.monkey.user?.id;
        return await this.monkey.write(this.table, data);
    }
    
    async update(id, data) {
        return await this.monkey.update(this.table, { ...data, id });
    }
    
    async delete(id) {
        return await this.monkey.delete(this.table, id);
    }

    // ================================
    // FREQUENTLY USED - Status & Search
    // ================================
    
    async activate(id) {
        return await this.update(id, { status: 'active' });
    }
    
    async deactivate(id) {
        return await this.update(id, { status: 'inactive' });
    }
    
    async setStatus(id, status) {
        return await this.update(id, { status });
    }
    
    async search(query) {
        return await this.monkey.searchText(this.table, ['name', 'description'], query);
    }
    
    async filterByStatus(status) {
        return await this.monkey.read(this.table, [
            { operator: 'eq', args: ['status', status] }
        ]);
    }
    
    async getActive() {
        return await this.filterByStatus('active');
    }

    // ================================
    // GOOD TO HAVE - Enhanced Features
    // ================================
    
    async clone(id, newName = null) {
        const original = await this.get(id);
        if (!original) throw new Error('ICP not found');
        
        const cloneData = {
            ...original,
            name: newName || `${original.name} (Copy)`,
            status: 'draft'
        };
        
        // Remove fields that shouldn't be cloned
        delete cloneData.id;
        delete cloneData.created_at;
        delete cloneData.updated_at;
        
        return await this.create(cloneData);
    }
    
    
    async bulkActivate(ids) {
        return await this.monkey.bulkUpdate(this.table, ids, { status: 'active' });
    }
    
    async bulkDeactivate(ids) {
        return await this.monkey.bulkUpdate(this.table, ids, { status: 'inactive' });
    }
    
    async getStats(id) {
        const icp = await this.get(id);
        if (!icp) return null;
        
        // Get usage statistics from related tables
        const [prompts, websites, contentPipeline] = await Promise.all([
            this.monkey.read('prompts', [
            { operator: 'eq', args: ['icp_id', id] }
            ]),
            this.monkey.read('websites', [
            { operator: 'eq', args: ['icp_id', id] }
            ]),
            this.monkey.read('content_pipeline', [
            { operator: 'eq', args: ['icp_id', id] }
            ])
        ]);
        
        return {
            id,
            name: icp.name,
            promptsCount: prompts?.length || 0,
            websitesCount: websites?.length || 0,
            contentCount: contentPipeline?.length || 0,
            lastUsed: Math.max(
                new Date(icp.updated_at).getTime(),
                ...(prompts || []).map(p => new Date(p.updated_at).getTime()),
                ...(websites || []).map(w => new Date(w.updated_at).getTime()),
                ...(contentPipeline || []).map(c => new Date(c.updated_at).getTime())
            )
        };
    }

        /**
         * Export a single ICP by id or multiple ICPs by array of ids.
         * @param {string|string[]} idOrIds - Single id or array of ids.
         * @returns {Promise<Object|Object[]>} Exported ICP(s) in versioned format.
         */
        async export(idOrIds) {
            if (Array.isArray(idOrIds)) {
                // Export multiple ICPs
                const icps = await this.monkey.read(this.table, [
                    { operator: 'eq', args: ['id', idOrIds] }
                ]);
                if (!icps || icps.length === 0) throw new Error('No ICPs found');
                return icps.map(icp => ({
                    version: '1.0',
                    exportedAt: new Date().toISOString(),
                    data: icp.entity_json
                }));
            } else {
                // Export single ICP
                const icp = await this.get(idOrIds);
                if (!icp) throw new Error('ICP not found');
                return {
                    version: '1.0',
                    exportedAt: new Date().toISOString(),
                    data: icp.entity_json
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
        
        if (!data.name?.trim()) {
            errors.push('Name is required');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    async getCompletionScore(id) {
        const icp = await this.get(id);
        if (!icp) return 0;
        
        const fields = ['name', 'description'];
        
        const filledFields = fields.filter(field => 
            icp[field] && icp[field].toString().trim().length > 0
        );
        
        return Math.round((filledFields.length / fields.length) * 100);
    }
    
    async getSuggestions(id) {
        const icp = await this.get(id);
        if (!icp) return null;
        
        const completionScore = await this.getCompletionScore(id);
        const suggestions = [];
        
        if (completionScore < 100) {
            suggestions.push({
                type: 'completion',
                message: `Your ICP is ${completionScore}% complete. Consider filling in missing fields.`,
                priority: 'medium'
            });
        }
        
        if (!icp.description) {
            suggestions.push({
                type: 'field',
                field: 'description',
                message: 'Add a description to better define your ideal customer profile.',
                priority: 'high'
            });
        }
        
        return suggestions;
    }

    // ================================
    // TEMPLATE SYSTEM
    // ================================
    
    async getTemplates() {
        return [
            {
                id: 'enterprise',
                name: 'Enterprise SaaS Buyers',
                description: 'Decision makers at large companies evaluating SaaS solutions',
                data: {
                    name: "Enterprise SaaS Buyers",
                    short_desc: "Decision makers at large companies evaluating SaaS solutions",
                    icp_desc: `Large companies (500+ employees) evaluating enterprise SaaS solutions.

Key characteristics:
• C-level executives, IT Directors, and department heads
• Budget authority of $50K+ annually
• Focus on scalability, security, and compliance
• Require extensive vendor evaluation and ROI justification
• Value proven track records and enterprise-grade support`,
                    company_help: "We help enterprise organizations scale their operations through secure, compliant SaaS solutions with dedicated support."
                }
            },
            {
                id: 'startup',
                name: 'Tech Startup Founders',
                description: 'Early-stage startup founders looking for growth tools',
                data: {
                    name: "Tech Startup Founders",
                    short_desc: "Early-stage startup founders looking for growth tools",
                    icp_desc: `Early to mid-stage startup founders and CTOs building scalable businesses.

Key characteristics:
• Seed to Series B stage companies (10-100 employees)
• Budget conscious but willing to invest in growth
• Need tools that scale with rapid growth
• Prefer self-service and easy implementation
• Value speed and flexibility over enterprise features`,
                    company_help: "We help startups scale quickly with affordable, flexible tools that grow with their business."
                }
            },
            {
                id: 'smb',
                name: 'SMB Decision Makers',
                description: 'Small to medium business owners and managers',
                data: {
                    name: "SMB Decision Makers",
                    short_desc: "Small to medium business owners and managers",
                    icp_desc: `Small to medium business owners and department managers.

Key characteristics:
• Companies with 25-250 employees
• Budget range of $1K-$25K annually
• Wear multiple hats and need simple solutions
• Value ease of use and quick implementation
• Cost-sensitive with clear ROI requirements`,
                    company_help: "We help SMBs automate processes and increase productivity with easy-to-use, cost-effective solutions."
                }
            }
        ];
    }
    
    async createFromTemplate(templateId) {
        const templates = await this.getTemplates();
        const template = templates.find(t => t.id === templateId);
        
        if (!template) {
            throw new Error('Template not found');
        }
        
        return await this.create({
            ...template.data,
            status: 'draft'
        });
    }

    // ================================
    // UTILITY METHODS
    // ================================
    
    calculateCompletionScore(data) {
        const fields = ['name', 'description'];
        
        const filledFields = fields.filter(field => 
            data[field] && data[field].toString().trim().length > 0
        );
        
        return Math.round((filledFields.length / fields.length) * 100);
    }
}

// Export factory function instead of class
export async function initICP() {
    await monkey.init(true); // Full init mode to get user
    return new ICP();
}

// Export class for type checking if needed
export { ICP };

const icp = new ICP();
export { icp };