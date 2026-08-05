import http from '@/api/http';

export interface RegisterData {
    email: string;
    username: string;
    nameFirst: string;
    nameLast: string;
    password: string;
    passwordConfirmation: string;
    captchaToken?: string | null;
}

export interface RegisterResponse {
    success: boolean;
    message: string;
}

export default ({ email, username, nameFirst, nameLast, password, passwordConfirmation, captchaToken }: RegisterData): Promise<RegisterResponse> => {
    return new Promise((resolve, reject) => {
        http.get('/sanctum/csrf-cookie')
            .then(() =>
                http.post('/auth/register', {
                    email,
                    username,
                    name_first: nameFirst,
                    name_last: nameLast,
                    password,
                    password_confirmation: passwordConfirmation,
                    'captcha-response': captchaToken,
                })
            )
            .then((response) => {
                if (!(response.data instanceof Object)) {
                    return reject(new Error('An error occurred while processing the registration request.'));
                }

                return resolve({
                    success: response.data.data.success,
                    message: response.data.data.message,
                });
            })
            .catch(reject);
    });
};
