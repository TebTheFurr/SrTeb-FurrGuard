import http from '@/api/http';
import { Subdomain } from './getSubdomains';

export interface CreateSubdomainParams {
    subdomain: string;
    allocation_id: number;
    domain: string;
}

export interface CreateSubdomainResponse {
    success: boolean;
    subdomain: Subdomain;
}

export default async (uuid: string, params: CreateSubdomainParams): Promise<CreateSubdomainResponse> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/subdomains`, params);
    return data;
};
