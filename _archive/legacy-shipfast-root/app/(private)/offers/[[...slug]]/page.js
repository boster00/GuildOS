"use client";

import { useParams } from "next/navigation";
import OfferEditDetails from "../components/OfferEditDetails";
import OffersList from "../components/OffersList";

export default function OffersDynamicPage() {
  const params = useParams();
  const slug = params.slug || [];

  // Handle different URL patterns
  if (slug.length === 0) {
    // URL: /offers - Main listing
    return <OffersList />;
  }

  if (slug.length === 1) {
    const [firstParam] = slug;
    
    if (firstParam === "new") {
      // URL: /offers/new - Create new offer
      return <OfferEditDetails />;
    } else {
      // URL: /offers/[offer_id] - Edit/details (redirect to edit)
      const offerId = firstParam;
      return <OfferEditDetails offerId={offerId} />;
    }
  }

  if (slug.length === 2) {
    const [offerId, action] = slug;
    
    if (action === "edit") {
      // URL: /offers/[offer_id]/edit - Edit/details
      return <OfferEditDetails offerId={offerId} />;
    }
  }

  // 404 for unknown routes
  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
      <p className="text-gray-600">The requested offer page could not be found.</p>
    </div>
  );
}

