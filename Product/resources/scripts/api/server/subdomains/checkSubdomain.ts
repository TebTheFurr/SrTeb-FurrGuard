import http from '@/api/http';

export interface CheckSubdomainResponse {
    available: boolean;
    full_domain?: string;
    error?: string;
}

export default async (uuid: string, subdomain: string, domain: string): Promise<CheckSubdomainResponse> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/subdomains/check`, {
        params: { subdomain, domain },
    });
    return data;
};
