import http from '@/api/http';

export interface Subdomain {
    id: number;
    server_id: number;
    allocation_id: number;
    subdomain: string;
    domain: string;
    full_domain: string;
    proxied: boolean;
    created_at: string;
    updated_at: string;
    allocation?: {
        id: number;
        ip: string;
        port: number;
        alias: string | null;
    };
}

export interface Allocation {
    id: number;
    ip: string;
    port: number;
    alias: string | null;
    is_primary: boolean;
}

export interface SubdomainStatus {
    enabled: boolean;
    configured: boolean;
    domains: string[];
    maxPerServer: number;
    eggAllowed: boolean;
}

export interface SubdomainsResponse {
    status: SubdomainStatus;
    subdomains: Subdomain[];
    allocations: Allocation[];
}

export default async (uuid: string): Promise<SubdomainsResponse> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/subdomains`);
    return data;
};
