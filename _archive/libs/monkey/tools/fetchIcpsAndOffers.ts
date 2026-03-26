// ARCHIVED: Original path was libs/monkey/tools/fetchIcpsAndOffers.ts

/**
 * Tool to fetch ICPs and Offers from database
 * Server-side only - uses initICP and initOffers which require server context
 */

import { initICP } from "@/libs/icp/class";
import { initOffers } from "@/libs/offers/class";
import { log } from "../ui/logger";

export interface ICP {
  id: string;
  name: string;
  description?: string;
  [key: string]: any;
}

export interface Offer {
  id: string;
  name: string;
  description?: string;
  transactional_facts?: string;
  [key: string]: any;
}

export interface FetchIcpsAndOffersResult {
  icps: ICP[];
  offers: Offer[];
}

/**
 * Fetch all ICPs and Offers for the current user
 */
export async function fetchIcpsAndOffers(): Promise<FetchIcpsAndOffersResult> {
  log(`[fetchIcpsAndOffers] Fetching ICPs and Offers from database...`);

  try {
    // Fetch ICPs
    const icpInstance = await initICP();
    const icps = await icpInstance.list();
    log(`[fetchIcpsAndOffers] Fetched ${icps?.length || 0} ICPs`);

    // Fetch Offers
    const offersInstance = await initOffers();
    const offers = await offersInstance.list();
    log(`[fetchIcpsAndOffers] Fetched ${offers?.length || 0} Offers`);

    return {
      icps: (icps || []) as ICP[],
      offers: (offers || []) as Offer[],
    };
  } catch (error: any) {
    log(`[fetchIcpsAndOffers] Error fetching data: ${error.message}`);
    throw error;
  }
}
