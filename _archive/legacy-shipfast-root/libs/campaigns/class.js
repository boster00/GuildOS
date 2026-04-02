import monkey from "@/libs/monkey";

class Campaigns {
    constructor() {
        this.table = 'campaigns';
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
        if (!data.status) {
            data.status = 'planning';
        }
        return await this.monkey.write(this.table, data);
    }
    
    async update(id, data) {
        return await this.monkey.update(this.table, { ...data, id });
    }
    
    async delete(id) {
        return await this.monkey.delete(this.table, id);
    }

    // ================================
    // Enhanced Queries
    // ================================
    
    async getWithDetails(id) {
        const result = await this.monkey.getCampaignWithDetails(id);
        if (!result?.campaign) return null;
        const { campaign } = result;

        // Fetch article metadata only (no content_html for performance)
        // Full content will be loaded on-demand when editing each phase
        const articles = await this.monkey.read('content_magic_articles', [
            { operator: 'select', args: ['id,campaign_phase,title,status,created_at,updated_at'] },
            { operator: 'eq', args: ['campaign_id', id] }
        ]);

        return {
            ...campaign,
            articleMetadata: articles || []
        };
    }

    /**
     * List campaigns with only ICP and Offer names (lightweight for listing pages)
     * This is more efficient than listWithDetails() which loads full ICP/Offer objects
     */
    async listWithNames() {
        const campaigns = await this.list();
        
        if (!campaigns || campaigns.length === 0) {
            return [];
        }

        // Only fetch names, not full details
        const campaignPromises = campaigns.map(async (campaign) => {
            const result = { ...campaign };
            
            // Fetch ICP name if icp_id exists
            if (campaign.icp_id) {
                try {
                    const icp = await this.monkey.read('icps', [
                        { operator: 'select', args: ['name'] },
                        { operator: 'eq', args: ['id', campaign.icp_id] }
                    ]);
                    if (icp?.[0]?.name) {
                        result.icp = { name: icp[0].name };
                    }
                } catch (error) {

                }
            }
            
            // Fetch Offer name if offer_id exists
            if (campaign.offer_id) {
                try {
                    const offer = await this.monkey.read('offers', [
                        { operator: 'select', args: ['name'] },
                        { operator: 'eq', args: ['id', campaign.offer_id] }
                    ]);
                    if (offer?.[0]?.name) {
                        result.offer = { name: offer[0].name };
                    }
                } catch (error) {

                }
            }
            
            return result;
        });
        
        return await Promise.all(campaignPromises);
    }

    async listWithDetails() {
        const campaigns = await this.list();
        
        if (!campaigns || campaigns.length === 0) {
            return [];
        }

        const campaignPromises = campaigns.map(async (campaign) => {
            try {
                const result = await this.monkey.getCampaignWithDetails(campaign.id);
                const campaignWithDetails = result?.campaign;
                return campaignWithDetails || campaign;
            } catch (error) {

                return campaign; // Return basic campaign on error
            }
        });
        
        return await Promise.all(campaignPromises);
    }

    // ================================
    // Status Management
    // ================================
    
    async setStatus(id, status) {
        const validStatuses = ['planning', 'in_progress', 'completed', 'archived'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status: ${status}`);
        }
        return await this.update(id, { status });
    }

    async filterByStatus(status) {
        return await this.list([
            { operator: 'eq', args: ['status', status] }
        ]);
    }

    // ================================
    // Validation
    // ================================
    
    async validate(data) {
        const errors = [];
        
        if (!data.name?.trim()) {
            errors.push('Campaign name is required');
        }
        
        if (!data.icp_id) {
            errors.push('ICP selection is required');
        }
        
        if (!data.offer_id) {
            errors.push('Offer selection is required');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // ================================
    // Statistics
    // ================================
    
    async getStats(id) {
        const campaign = await this.get(id);
        if (!campaign) return null;

        const articles = await this.monkey.read('content_magic_articles', [
            { operator: 'eq', args: ['campaign_id', id] }
        ]);

        return {
            id,
            name: campaign.name,
            articlesCount: articles?.length || 0,
            status: campaign.status,
            lastUpdated: campaign.updated_at
        };
    }
}

// Export factory function
export async function initCampaigns() {
    await monkey.init(true);
    return new Campaigns();
}

// Export class
export { Campaigns };

// Export singleton instance
const campaigns = new Campaigns();
export default campaigns;