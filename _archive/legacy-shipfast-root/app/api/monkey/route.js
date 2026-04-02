import monkey from '@/libs/monkey';
import { createClient } from '@/libs/supabase/service';


export async function POST(request) {
    try {
        const whiteListTables = ['cron_jobs','prompts','prompt_history'];// this list defines which tables can be accessed with service role key (no row level security)
        const whiteListActions = ['webSearch', 'webExtract']; // actions that don't use database tables
        await monkey.init();
        const body = await request.json();
        monkey.log('Monkey API called, body=',body);
        const table = body.table || 'not set';
        const action = body.action || 'not set';
        
        // Skip table whitelist check for special actions that don't use database tables
        if (!whiteListActions.includes(action) && !whiteListTables.includes(table)) {
            return Response.json({ success: false, error: 'Table not in whitelist' }, { status: 400 });
        }
        
        const payload = body.payload || {};
        monkey.supabase = await createClient();
        const result = await monkey[action](table, payload);
        monkey.log('Monkey API responded, result=',result);
        return Response.json({ success: true, result });
    } catch (error) {
        monkey.log('Monkey API ERROR!, error.message=',error.message);
        return Response.json({ success: false, error: error.message }, { status: 400 });
    }
}