import http from '@/api/http';

export interface LanguagesResponse {
    languages: Record<string, string>;
}

export default async (): Promise<Record<string, string>> => {
    const { data } = await http.get<LanguagesResponse>('/api/client/account/languages');
    return data.languages;
};
