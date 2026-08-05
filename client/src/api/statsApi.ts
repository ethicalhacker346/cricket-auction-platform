import axios from 'axios';
import { axiosClient } from "@/api/axiosClient";

export interface PublicStats {
  playersCount: number;
  franchisesCount: number;
  tournamentsCount: number;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  const { data } = await axiosClient.get('/api/stats/public');
  return data.data as PublicStats;
}