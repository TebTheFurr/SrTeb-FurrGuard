import http from '@/api/http';

export interface ReverseProxy {
    id: number;
    domain: string;
    proxy_type: string;
    ssl_enabled: boolean;
    ssl_type: string;
    status: string;
    error_message: string | null;
    dns_verified: boolean;
    expected_dns_ip: string;
    allocation: {
        id: number;
        ip: string;
        port: number;
        alias: string;
    } | null;
    created_at: string;
}

export interface ReverseProxiesResponse {
    status: {
        enabled: boolean;
        configured: boolean;
        proxy_type: string;
        ssl_type: string;
        max_per_server: number;
        egg_allowed: boolean;
    };
    proxies: ReverseProxy[];
    allocations: Array<{
        id: number;
        ip: string;
        port: number;
        alias: string;
        is_primary: boolean;
    }>;
}

export interface CreateReverseProxyData {
    domain: string;
    allocation_id: number;
    ssl_enabled: boolean;
}

const getReverseProxies = (uuid: string): Promise<ReverseProxiesResponse> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/servers/${uuid}/reverse-proxies`)
            .then(({ data }: { data: ReverseProxiesResponse }) => resolve(data))
            .catch(reject);
    });
};

export default getReverseProxies;

export const createReverseProxy = (uuid: string, data: CreateReverseProxyData): Promise<any> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/reverse-proxies`, data)
            .then(({ data }: { data: any }) => resolve(data))
            .catch(reject);
    });
};

export const deleteReverseProxy = (uuid: string, proxyId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/client/servers/${uuid}/reverse-proxies/${proxyId}`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const confirmReverseProxyDns = (uuid: string, proxyId: number): Promise<any> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/reverse-proxies/${proxyId}/confirm-dns`)
            .then(({ data }: { data: any }) => resolve(data))
            .catch(reject);
    });
};

export const checkDomain = (
    uuid: string,
    domain: string,
    allocationId?: number | null
): Promise<{ valid: boolean; available: boolean; dns_matches: boolean; expected_ip: string; resolved_ips: string[]; domain: string }> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/servers/${uuid}/reverse-proxies/check-domain`, {
            params: { domain, allocation_id: allocationId || undefined },
        })
            .then(({ data }: { data: { valid: boolean; available: boolean; dns_matches: boolean; expected_ip: string; resolved_ips: string[]; domain: string } }) => resolve(data))
            .catch(reject);
    });
};
