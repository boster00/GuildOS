// import { createClient } from "@/libs/supabase/server";
import monkey from "@/libs/monkey";

export async function GET() {
    // const supabase = await createClient();
    
    // Render the HTML as a string
    const user = await monkey.initUser();
    // 1. use user->id to fetch icp_profiles table. 
    // 1.1 if no rows, return the component "ICPSetupWizard"
    // 1.2 if rows, return the component "ICPList" with the rows as props.
    const aiResult = await monkey.AI("tell a cat joke");
    const html = `
        <main class="min-h-screen p-8 pb-24">
            <h1>Cat Joke</h1>
            <p>${aiResult}</p>
            <p>This API takes post requests.</p>
        </main>
    `;

    return new Response(html, {
        headers: { "Content-Type": "text/html" },
    });
}
export async function POST(request) {
    const body = await request.json();

    if (body.action === "saveICP") {
        const user = await monkey.initUser();
        body.userId = user.id;
        // 1. check if ICPid exists in body.formData,
        let existingICP = null;
        if (body.formData.ICPid) {
            // 1.1 if so, update the existing entry
            existingICP = {id: body.formData.ICPid};
        } else {
            // 1.2 else check if the user already has an ICP with the same name
            // const icps = await monkey.read("icp_profiles", { icp_name: body.formData.icpName, user_id: user.id });
            const icps = await monkey.read("icp_profiles", [
                { operator: "eq", args: ["icp_name",body.formData.icpName] },
                { operator: "eq", args: ["user_id",user.id] }
            ]);
            if (icps && icps.length > 0) {
            // 1.3 if so, update that
            existingICP = icps[0];
            body.formData.ICPid = existingICP.id;
            return new Response(JSON.stringify({ warning: `${body.formData.icpName} already exists` }), {
                headers: { "Content-Type": "application/json" },
            });
            }else{
            existingICP = null;
            }
            // 1.4 else create a new entry (handled below)
        }
        const { userId, ICPid, ...formDataWithoutIds } = body.formData;
        const mappedData = {
            icp_name: body.formData.icpName,
            company_description: body.formData.companyDescription,
            icp_description: body.formData.ICPDescription,
            offer_names: body.formData.offerNames
            ? body.formData.offerNames.split(',').map(s => s.trim())
            : [],
            user_id: body.userId,
            json: { ...formDataWithoutIds }
        };
        let result = null;
        if (existingICP) {
            result = await monkey.update("icp_profiles", mappedData, existingICP.id);
        } else {
            // Create a new entry in supabase using monkey.write
            mappedData.importance_level = "primary";
            result = await monkey.write("icp_profiles", mappedData);
        }
        return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
        });
    }
    if (body.action === "test") {
        return new Response(JSON.stringify({ ...body, warning: true }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    // Handle other actions or return a default response
    return new Response(JSON.stringify({ error: "Unknown action" }), {
        headers: { "Content-Type": "application/json" },
    });
}