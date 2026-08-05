import http from '@/api/http';

export interface FreeServerClaim {
    id: number;
    offer_name: string;
    offer_description: string;
    memory: number;
    disk: number;
    cpu: number;
    claim_expires_at: string | null;
    server_expiry_days: number | null;
}

export const getPendingOffers = async (): Promise<FreeServerClaim[]> => {
    const { data } = await http.get('/api/client/account/free-servers');
    return data.claims || [];
};

export const claimOffer = async (
    claimId: number
): Promise<{ success: boolean; server_id?: string; redirect_url?: string }> => {
    const { data } = await http.post(`/api/client/account/free-servers/${claimId}/claim`);
    return data;
};
