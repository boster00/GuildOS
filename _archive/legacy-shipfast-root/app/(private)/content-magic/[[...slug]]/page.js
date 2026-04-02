import { Suspense } from "react";
import { notFound } from "next/navigation";
import ContentMagicArticlePage from "../components/ContentMagicArticlePage";
import ContentMagicList from "../components/ContentMagicList";
import ContentMagicWizard from "../components/ContentMagicWizard";
import { createClient } from "@/libs/supabase/server";

export default async function Page({ params: paramsPromise }) {
    const params = await paramsPromise;
    const slug = params.slug?.[0];

    // If no slug, show the list
    if (!slug) {
        return (
            <Suspense>
                <ContentMagicList />
            </Suspense>
        );
    }

    // If "new", show the wizard
    if (slug === "new") {
        return (
            <Suspense>
                <ContentMagicWizard />
            </Suspense>
        );
    }

    // Otherwise, fetch and show article detail page
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return <div>Not authenticated</div>;
    }
    const { data: article, error } = await supabase
        .from("content_magic_articles")
        .select("*")
        .eq("id", slug)
        .eq("user_id", user.id)
        .single();

    if (error) {
        return <div>Article not found</div>;
    }

    if (!article) {
        return <div>Article not found</div>;
    }

    const contentLen = article?.content_html != null ? String(article.content_html).length : 0;
    const hasContent = contentLen > 0;
    if (article?.id && !hasContent) {
        
    }

    return (
        <Suspense>
            <ContentMagicArticlePage article={article} />
        </Suspense>
    );
}