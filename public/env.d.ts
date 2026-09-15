/// <reference types="vite/client" />

/** Datos que inyecta /verify.php (docs/API.md §3). Fechas en UTC `YYYY-MM-DD HH:MM:SS`. */
type VerifyData =
  | {
      state: 'confirm'
      csrf: string
      token: string
      minecraft_nick: string
      request_ip: string
      request_country: string | null
      request_country_code: string | null
      requested_at: string
      token_expires_at: string
    }
  | { state: 'success'; title: string; message: string }
  | { state: 'error'; title: string; message: string; code: string }

interface Window {
  __VERIFY_DATA__?: VerifyData
}
