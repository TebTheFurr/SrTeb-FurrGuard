import http from '@/api/http';

export default async (language: string): Promise<void> => {
    await http.put('/api/client/account/language', { language });
};
