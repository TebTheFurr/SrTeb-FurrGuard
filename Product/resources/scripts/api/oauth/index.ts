import http from '@/api/http';
import { OAuthProvider } from '@/components/auth/OAuthButtons';

export interface OAuthIdentity {
    id: number;
    provider: OAuthProvider | null;
    provider_email: string | null;
    provider_name: string | null;
    provider_avatar: string | null;
    created_at: string | null;
}

export interface OAuthAccountResponse {
    identities: OAuthIdentity[];
    providers: OAuthProvider[];
}

export const getOAuthProviders = (): Promise<OAuthProvider[]> =>
    http.get('/api/client/oauth/providers').then(({ data }) => data.data || []);

export const getOAuthIdentities = (): Promise<OAuthAccountResponse> =>
    http.get('/api/client/account/oauth/identities').then(({ data }) => ({
        identities: data.data || [],
        providers: data.providers || [],
    }));

export const unlinkOAuthIdentity = (id: number): Promise<void> =>
    http.delete(`/api/client/account/oauth/identities/${id}`).then(() => undefined);

export const getOAuthLinkUrl = (providerKey: string): string => `/auth/oauth/${encodeURIComponent(providerKey)}/link`;
