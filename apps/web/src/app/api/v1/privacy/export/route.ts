import { exportMyData } from "@glamotion/core";
import { api } from "@/server/api";
export const GET = api((c) => exportMyData(c));
