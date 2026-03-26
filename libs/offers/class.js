import monkey from "@/libs/monkey";

class Offers {
    constructor() {
        this.table = 'offers';
        this.monkey = monkey;
    }

    // ================================
    // Core CRUD Operations
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
    // Validation
    // ================================
    
    async validate(data) {
        const errors = [];
        
        if (!data.name?.trim()) {
            errors.push('Offer name is required');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // ================================
    // Usage Statistics
    // ================================
    
    async getUsageStats(id) {
        // Get count of campaigns using this offer
        const campaigns = await this.monkey.read('campaigns', [
            { operator: 'eq', args: ['offer_id', id] }
        ]);
        
        return {
            campaignsCount: campaigns?.length || 0,
            campaigns: campaigns || []
        };
    }
}

// Export factory function
export async function initOffers() {
    await monkey.init(true);
    return new Offers();
}

// Export class
export { Offers };

// Export singleton instance
const offers = new Offers();
export default offers;