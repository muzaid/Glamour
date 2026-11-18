import { runwayFeed } from "@glamotion/core";
import { api } from "@/server/api";

/** Public runway feed: published looks + published products, server-priced. */
export const dynamic = "force-dynamic";
export const GET = api((c) => ({ data: runwayFeed(c) }));
