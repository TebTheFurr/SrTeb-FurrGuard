import http from '@/api/http';

export default (): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve, reject) => {
        http.post('/api/client/account/email/resend-verification')
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};
