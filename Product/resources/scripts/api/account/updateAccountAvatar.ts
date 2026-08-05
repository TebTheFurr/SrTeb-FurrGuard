import http from '@/api/http';

export interface AccountAvatarResponse {
    image: string;
}

export const updateAccountAvatar = async (avatar: File): Promise<AccountAvatarResponse> => {
    const formData = new FormData();
    formData.append('avatar', avatar);

    const { data } = await http.post('/api/client/account/avatar', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return data;
};

export const removeAccountAvatar = async (): Promise<AccountAvatarResponse> => {
    const { data } = await http.delete('/api/client/account/avatar');

    return data;
};
