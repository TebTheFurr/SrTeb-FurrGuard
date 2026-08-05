import http from '@/api/http';

export type BillingPlatform = 'whmcs' | 'paymenter';

export interface BillingInfo {
    enabled: boolean;
    configured?: boolean;
    platform?: BillingPlatform;
    serviceId?: string;
    productName?: string | null;
    planName?: string | null;
    status?: string | null;
    amount?: string | null;
    billingCycle?: string | null;
    billingEmail?: string | null;
    nextDueDate?: string | null;
    renewsAt?: string | null;
    expiresAt?: string | null;
    viewUrl?: string | null;
    error?: string;
}

export default (uuid: string): Promise<BillingInfo> => {
    return http.get(`/api/client/servers/${uuid}/billing`).then(({ data }) => data);
};
