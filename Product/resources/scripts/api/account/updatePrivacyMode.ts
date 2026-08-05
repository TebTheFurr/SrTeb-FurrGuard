import http from '@/api/http';

export default (privacyMode: boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.put('/api/client/account/privacy-mode', { privacy_mode: privacyMode })
            .then(() => resolve())
            .catch(reject);
    });
};
